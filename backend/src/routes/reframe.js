const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const Transcript = require('../models/Transcript');
const logger = require('../utils/logger');

const router = express.Router();
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

// Configure multer for temporary file storage
const upload = multer({
    dest: 'uploads/temp/',
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit for preview clips
    }
});

// Aspect ratio configurations for different platforms
const ASPECT_RATIOS = {
    'tiktok': { width: 9, height: 16, name: 'TikTok/Shorts' },
    'instagram': { width: 1, height: 1, name: 'Instagram Square' },
    'youtube': { width: 16, height: 9, name: 'YouTube Landscape' },
    'story': { width: 9, height: 16, name: 'Instagram/Facebook Story' }
};

/**
 * Calculate optimal crop parameters based on subject detections and target aspect ratio
 * @param {Object} detections - MediaPipe detection results from frontend
 * @param {Object} targetRatio - Target aspect ratio configuration
 * @param {Object} videoDimensions - Original video width and height
 * @returns {Object} Crop parameters for FFmpeg
 */
function calculateOptimalCrop(detections, targetRatio, videoDimensions) {
    const { width: videoWidth, height: videoHeight } = videoDimensions;
    const { width: ratioW, height: ratioH } = targetRatio;
    const targetAspect = ratioW / ratioH;
    
    logger.info('Starting subject-first crop calculation', {
        videoWidth,
        videoHeight,
        targetAspect,
        targetRatioConfig: targetRatio,
        detectionsCount: detections?.length || 0
    });
    
    // Subject-first approach: Calculate bounding box that encompasses all high-confidence subjects
    let subjectBounds = {
        minX: 1.0,
        maxX: 0.0,
        minY: 1.0,
        maxY: 0.0,
        isValid: false
    };
    
    let validDetections = 0;
    const MIN_CONFIDENCE = 0.5; // Increased from 0.1 for better reliability
    
    if (detections && detections.length > 0) {
        detections.forEach((detection, index) => {
            // Enhanced detection filtering
            if (!detection.confidence || detection.confidence < MIN_CONFIDENCE) {
                logger.info(`Skipping detection ${index} with low confidence`, {
                    confidence: detection.confidence,
                    threshold: MIN_CONFIDENCE
                });
                return;
            }
            
            // Skip detections with negative scores (often false positives)
            if (detection.score && detection.score < 0) {
                logger.info(`Skipping detection ${index} with negative score`, {
                    score: detection.score
                });
                return;
            }
            
            let centerX, centerY;
            
            if (detection.boundingBox) {
                // Validate bounding box data
                const bbox = detection.boundingBox;
                if (bbox.left < 0 || bbox.top < 0 || bbox.width <= 0 || bbox.height <= 0) {
                    logger.warn(`Invalid bounding box for detection ${index}`, { bbox });
                    return;
                }
                
                // Face detection bounding box is in PIXEL coordinates - need to normalize
                const pixelCenterX = bbox.left + bbox.width / 2;
                const pixelCenterY = bbox.top + bbox.height / 2;
                
                // Validate video dimensions are available
                if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
                    logger.error('Invalid video dimensions for normalization', { videoWidth, videoHeight });
                    return;
                }
                
                // Normalize to 0-1 range
                centerX = pixelCenterX / videoWidth;
                centerY = pixelCenterY / videoHeight;
                
                logger.info('Face detection processed', {
                    index,
                    originalPixelCenter: { x: pixelCenterX, y: pixelCenterY },
                    normalizedCenter: { x: centerX, y: centerY },
                    confidence: detection.confidence
                });
            } else if (detection.x !== undefined && detection.y !== undefined) {
                // Pose points are already normalized (0-1)
                centerX = detection.x;
                centerY = detection.y;
                
                logger.info('Pose detection processed', {
                    index,
                    normalizedCenter: { x: centerX, y: centerY },
                    confidence: detection.confidence
                });
            }
            
            if (centerX !== undefined && centerY !== undefined && !isNaN(centerX) && !isNaN(centerY)) {
                // Ensure coordinates are valid
                centerX = Math.max(0, Math.min(1, centerX));
                centerY = Math.max(0, Math.min(1, centerY));
                
                // Update subject bounding box to encompass this detection
                subjectBounds.minX = Math.min(subjectBounds.minX, centerX);
                subjectBounds.maxX = Math.max(subjectBounds.maxX, centerX);
                subjectBounds.minY = Math.min(subjectBounds.minY, centerY);
                subjectBounds.maxY = Math.max(subjectBounds.maxY, centerY);
                subjectBounds.isValid = true;
                validDetections++;
                
                logger.info('Detection added to subject bounds', {
                    detection: { x: centerX, y: centerY, type: detection.type },
                    currentBounds: subjectBounds
                });
            }
        });
    }
    
    // Calculate subject area properties
    let subjectCenterX, subjectCenterY, subjectWidth, subjectHeight;
    
    if (subjectBounds.isValid && validDetections > 0) {
        subjectWidth = subjectBounds.maxX - subjectBounds.minX;
        subjectHeight = subjectBounds.maxY - subjectBounds.minY;
        subjectCenterX = subjectBounds.minX + subjectWidth / 2;
        subjectCenterY = subjectBounds.minY + subjectHeight / 2;
        
        // Handle very small subject areas (single points or tightly clustered detections)
        const MIN_SUBJECT_SIZE = 0.05; // 5% minimum subject area
        if (subjectWidth < MIN_SUBJECT_SIZE || subjectHeight < MIN_SUBJECT_SIZE) {
            logger.info('Very small subject area detected, expanding bounds', {
                originalBounds: { width: subjectWidth, height: subjectHeight },
                minSize: MIN_SUBJECT_SIZE
            });
            
            // Expand around the center to create a reasonable subject area
            const expandWidth = Math.max(MIN_SUBJECT_SIZE, subjectWidth) / 2;
            const expandHeight = Math.max(MIN_SUBJECT_SIZE, subjectHeight) / 2;
            
            subjectBounds.minX = Math.max(0, subjectCenterX - expandWidth);
            subjectBounds.maxX = Math.min(1, subjectCenterX + expandWidth);
            subjectBounds.minY = Math.max(0, subjectCenterY - expandHeight);
            subjectBounds.maxY = Math.min(1, subjectCenterY + expandHeight);
            
            subjectWidth = subjectBounds.maxX - subjectBounds.minX;
            subjectHeight = subjectBounds.maxY - subjectBounds.minY;
        }
        
        logger.info('Calculated subject group bounding box', {
            subjectBounds,
            subjectCenter: { x: subjectCenterX, y: subjectCenterY },
            subjectDimensions: { width: subjectWidth, height: subjectHeight },
            validDetections
        });
    } else {
        // Fallback to center when no valid detections
        subjectCenterX = 0.5;
        subjectCenterY = 0.5;
        subjectWidth = 0.1; // Small default area
        subjectHeight = 0.1;
        
        logger.warn('No valid detections - using fallback center', {
            fallbackCenter: { x: subjectCenterX, y: subjectCenterY },
            fallbackDimensions: { width: subjectWidth, height: subjectHeight }
        });
    }
    
    // Maximum zoom approach: Calculate largest possible crop that keeps subjects centered
    // Start with maximum possible crop for the target aspect ratio
    const videoAspect = videoWidth / videoHeight;
    const MAX_CROP_RATIO = 0.98; // Use 98% of video dimensions for maximum zoom
    
    let maxPossibleWidth, maxPossibleHeight;
    
    if (videoAspect > targetAspect) {
        // Video is wider than target - height is limiting
        maxPossibleHeight = MAX_CROP_RATIO;
        maxPossibleWidth = maxPossibleHeight * targetAspect;
    } else {
        // Video is taller than target - width is limiting
        maxPossibleWidth = MAX_CROP_RATIO;
        maxPossibleHeight = maxPossibleWidth / targetAspect;
    }
    
    logger.info('Maximum possible crop calculated', {
        videoAspect,
        targetAspect,
        maxPossibleCrop: { width: maxPossibleWidth, height: maxPossibleHeight }
    });
    
    // Now determine if we can use the maximum crop while keeping subjects centered
    // Check if subjects would still be contained with maximum crop centered on subject center
    let cropWidth = maxPossibleWidth;
    let cropHeight = maxPossibleHeight;
    
    // Calculate where the max crop would be positioned if centered on subjects
    let idealCropX = subjectCenterX - cropWidth / 2;
    let idealCropY = subjectCenterY - cropHeight / 2;
    
    // Check if this positioning keeps the crop within video bounds
    if (idealCropX < 0 || idealCropY < 0 || 
        idealCropX + cropWidth > 1 || idealCropY + cropHeight > 1) {
        
        logger.info('Maximum crop cannot be centered on subjects, calculating constrained crop');
        
        // Calculate the maximum crop size that can be centered on the subject
        // Find the limiting dimension based on subject position
        const maxXRadius = Math.min(subjectCenterX, 1 - subjectCenterX);
        const maxYRadius = Math.min(subjectCenterY, 1 - subjectCenterY);
        
        // Calculate maximum crop that fits within these radii
        const maxCenteredWidth = 2 * maxXRadius;
        const maxCenteredHeight = 2 * maxYRadius;
        
        // Apply aspect ratio constraint to get final dimensions
        if (maxCenteredWidth / maxCenteredHeight > targetAspect) {
            // Width is not the limiting factor, use height
            cropHeight = maxCenteredHeight;
            cropWidth = cropHeight * targetAspect;
        } else {
            // Height is not the limiting factor, use width
            cropWidth = maxCenteredWidth;
            cropHeight = cropWidth / targetAspect;
        }
        
        logger.info('Calculated constrained crop for subject centering', {
            subjectCenter: { x: subjectCenterX, y: subjectCenterY },
            maxRadii: { x: maxXRadius, y: maxYRadius },
            constrainedCrop: { width: cropWidth, height: cropHeight }
        });
    }
    
    // Perfect centering: Position crop exactly centered on subject center
    let cropX = subjectCenterX - cropWidth / 2;
    let cropY = subjectCenterY - cropHeight / 2;
    
    logger.info('Maximum zoom crop positioned for perfect subject centering', {
        subjectCenter: { x: subjectCenterX, y: subjectCenterY },
        cropDimensions: { width: cropWidth, height: cropHeight },
        cropPosition: { x: cropX, y: cropY },
        zoomLevel: `${Math.round((1 / Math.max(cropWidth, cropHeight)) * 100)}%`
    });
    
    // Convert to pixel coordinates (ensure even numbers for video encoding)
    let pixelWidth = Math.floor(cropWidth * videoWidth / 2) * 2;
    let pixelHeight = Math.floor(cropHeight * videoHeight / 2) * 2;
    let pixelX = Math.floor(cropX * videoWidth / 2) * 2;
    let pixelY = Math.floor(cropY * videoHeight / 2) * 2;
    
    // Apply minimal safety margin only if absolutely necessary
    const pixelSafetyMargin = 2; // 2 pixel margin for encoding compatibility
    
    // Ensure we don't exceed video bounds with safety margin
    if (pixelX + pixelWidth > videoWidth - pixelSafetyMargin) {
        pixelX = videoWidth - pixelWidth - pixelSafetyMargin;
    }
    if (pixelY + pixelHeight > videoHeight - pixelSafetyMargin) {
        pixelY = videoHeight - pixelHeight - pixelSafetyMargin;
    }
    
    // Ensure we don't go below safety margin
    pixelX = Math.max(pixelSafetyMargin, pixelX);
    pixelY = Math.max(pixelSafetyMargin, pixelY);
    
    // Ensure minimum dimensions for encoding compatibility
    pixelWidth = Math.max(pixelWidth, 32);
    pixelHeight = Math.max(pixelHeight, 32);
    
    // Verify and correct aspect ratio at pixel level
    const pixelAspect = pixelWidth / pixelHeight;
    if (Math.abs(pixelAspect - targetAspect) > 0.01) {
        logger.info('Correcting pixel aspect ratio', {
            pixelAspect,
            targetAspect,
            originalPixelWidth: pixelWidth,
            originalPixelHeight: pixelHeight
        });
        
        if (pixelAspect > targetAspect) {
            pixelWidth = Math.floor(pixelHeight * targetAspect / 2) * 2;
        } else {
            pixelHeight = Math.floor(pixelWidth / targetAspect / 2) * 2;
        }
    }
    
    // Final bounds validation
    pixelX = Math.max(0, Math.min(pixelX, videoWidth - pixelWidth));
    pixelY = Math.max(0, Math.min(pixelY, videoHeight - pixelHeight));
    
    // Final validation: Verify subject bounds are contained in final crop
    const subjectPixelBounds = {
        minX: Math.round(subjectBounds.minX * videoWidth),
        maxX: Math.round(subjectBounds.maxX * videoWidth),
        minY: Math.round(subjectBounds.minY * videoHeight),
        maxY: Math.round(subjectBounds.maxY * videoHeight)
    };
    
    const cropPixelBounds = {
        left: pixelX,
        right: pixelX + pixelWidth,
        top: pixelY,
        bottom: pixelY + pixelHeight
    };
    
    const subjectFullyContained = subjectBounds.isValid ? (
        subjectPixelBounds.minX >= cropPixelBounds.left &&
        subjectPixelBounds.maxX <= cropPixelBounds.right &&
        subjectPixelBounds.minY >= cropPixelBounds.top &&
        subjectPixelBounds.maxY <= cropPixelBounds.bottom
    ) : true; // If no detections, consider it contained
    
    const result = {
        width: pixelWidth,
        height: pixelHeight,
        x: pixelX,
        y: pixelY,
        centerX: Math.round(subjectCenterX * videoWidth),
        centerY: Math.round(subjectCenterY * videoHeight),
        zoomFactor: 1.0 / Math.max(cropWidth, cropHeight)
    };
    
    logger.info('Subject-first crop calculation completed', {
        algorithm: 'subject-first',
        videoDimensions: { width: videoWidth, height: videoHeight },
        targetAspect,
        subjectAnalysis: {
            validDetections,
            subjectBounds: subjectBounds.isValid ? subjectBounds : 'fallback',
            subjectCenter: { x: subjectCenterX, y: subjectCenterY },
            subjectDimensions: { width: subjectWidth, height: subjectHeight }
        },
        cropAnalysis: {
            normalizedCrop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
            pixelCrop: { x: pixelX, y: pixelY, width: pixelWidth, height: pixelHeight },
            boundsAdjustmentApplied: boundsAdjustmentNeeded,
            subjectFullyContained
        },
        result
    });
    
    if (!subjectFullyContained && subjectBounds.isValid) {
        logger.warn('ATTENTION: Subject may not be fully contained in final crop', {
            subjectPixelBounds,
            cropPixelBounds,
            recommendation: 'Consider increasing SUBJECT_PADDING or review detection accuracy'
        });
    }
    
    return result;
}

/**
 * Generate a preview frame with crop overlay
 * @param {string} videoPath - Path to input video
 * @param {Object} cropParams - Crop parameters
 * @param {number} timestamp - Timestamp for frame extraction (seconds)
 * @returns {Promise<string>} Path to generated preview image
 */
function generatePreviewFrame(videoPath, cropParams, timestamp = 5) {
    return new Promise((resolve, reject) => {
        // Validate inputs
        if (!fs.existsSync(videoPath)) {
            return reject(new Error(`Video file not found: ${videoPath}`));
        }
        
        if (cropParams.width <= 0 || cropParams.height <= 0) {
            return reject(new Error(`Invalid crop dimensions: ${cropParams.width}x${cropParams.height}`));
        }
        
        const previewPath = path.join('uploads/temp', `preview_${Date.now()}.jpg`);
        
        // Get video info first to validate crop parameters
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                logger.logError(err, { context: 'preview_ffprobe', videoPath });
                return reject(err);
            }
            
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (!videoStream) {
                return reject(new Error('No video stream found'));
            }
            
            const videoWidth = videoStream.width;
            const videoHeight = videoStream.height;
            
            // Validate crop parameters against video dimensions with safety margin
            const safetyMargin = 4; // 4 pixel safety margin for better compatibility
            
            // Check each condition individually for better debugging
            const rightEdge = cropParams.x + cropParams.width;
            const bottomEdge = cropParams.y + cropParams.height;
            const maxX = videoWidth - safetyMargin;
            const maxY = videoHeight - safetyMargin;
            
            const rightExceeds = rightEdge > maxX;
            const bottomExceeds = bottomEdge > maxY;
            const leftTooSmall = cropParams.x < safetyMargin;
            const topTooSmall = cropParams.y < safetyMargin;
            
            logger.info('Crop validation details', {
                videoWidth,
                videoHeight,
                cropParams,
                safetyMargin,
                checks: {
                    rightEdge,
                    bottomEdge,
                    maxX,
                    maxY,
                    rightExceeds,
                    bottomExceeds,
                    leftTooSmall,
                    topTooSmall
                }
            });
            
            if (rightExceeds || bottomExceeds || leftTooSmall || topTooSmall) {
                // Attempt to auto-correct minor bounds violations
                let correctedParams = { ...cropParams };
                let correctionApplied = false;
                
                if (leftTooSmall) {
                    correctedParams.x = safetyMargin;
                    correctionApplied = true;
                    logger.info('Auto-correcting x position', { 
                        original: cropParams.x, 
                        corrected: correctedParams.x 
                    });
                }
                
                if (topTooSmall) {
                    correctedParams.y = safetyMargin;
                    correctionApplied = true;
                    logger.info('Auto-correcting y position', { 
                        original: cropParams.y, 
                        corrected: correctedParams.y 
                    });
                }
                
                if (rightExceeds) {
                    correctedParams.x = maxX - correctedParams.width;
                    correctionApplied = true;
                    logger.info('Auto-correcting x for right edge', { 
                        original: cropParams.x, 
                        corrected: correctedParams.x 
                    });
                }
                
                if (bottomExceeds) {
                    correctedParams.y = maxY - correctedParams.height;
                    correctionApplied = true;
                    logger.info('Auto-correcting y for bottom edge', { 
                        original: cropParams.y, 
                        corrected: correctedParams.y 
                    });
                }
                
                if (correctionApplied) {
                    logger.info('Applied auto-corrections to crop parameters', {
                        original: cropParams,
                        corrected: correctedParams
                    });
                    // Use corrected parameters
                    Object.assign(cropParams, correctedParams);
                } else {
                    logger.logError(new Error('Crop parameters exceed video dimensions'), {
                        context: 'crop_validation',
                        videoWidth,
                        videoHeight,
                        cropParams,
                        safetyMargin,
                        failedChecks: {
                            rightExceeds,
                            bottomExceeds,
                            leftTooSmall,
                            topTooSmall
                        }
                    });
                    return reject(new Error('Crop parameters exceed video dimensions'));
                }
            }
            
            // Ensure timestamp is within video duration
            const duration = parseFloat(videoStream.duration) || parseFloat(metadata.format.duration) || 60;
            const safeTimestamp = Math.min(timestamp, duration - 1);
            
            ffmpeg(videoPath)
                .seekInput(safeTimestamp)
                .frames(1)
                .videoFilters([
                    `crop=${cropParams.width}:${cropParams.height}:${cropParams.x}:${cropParams.y}`,
                    'scale=400:-1' // Scale for web preview
                ])
                .output(previewPath)
                .on('end', () => resolve(previewPath))
                .on('error', (err) => {
                    logger.logError(err, { context: 'preview_generation', cropParams, videoPath, timestamp: safeTimestamp });
                    reject(err);
                })
                .run();
        });
    });
}

/**
 * Analyze video for reframing suggestions
 * POST /clips/reframe/analyze
 */
router.post('/analyze', upload.single('video'), async (req, res) => {
    try {
        const { detections, targetPlatform, transcriptId, generatedClipUrl } = req.body;
        const videoFile = req.file;
        
        if (!videoFile && !transcriptId) {
            return res.status(400).json({ 
                error: 'Either video file or transcript ID is required' 
            });
        }
        
        if (!targetPlatform || !ASPECT_RATIOS[targetPlatform]) {
            return res.status(400).json({ 
                error: 'Valid target platform is required',
                supportedPlatforms: Object.keys(ASPECT_RATIOS)
            });
        }
        
        let videoPath;
        let videoDimensions;
        
        // Use generated clip URL if provided, otherwise use original video from transcript
        if (transcriptId) {
            const transcript = await Transcript.findById(transcriptId);
            if (!transcript) {
                return res.status(404).json({ error: 'Transcript not found' });
            }
            
            // Download video from cloud storage for processing
            const tempVideoPath = path.join('uploads/temp', `reframe_${transcriptId}_${Date.now()}.mp4`);
            
            // Use generated clip URL if provided, otherwise use original video
            const videoUrlToUse = generatedClipUrl || transcript.videoUrl;
            
            if (!videoUrlToUse) {
                return res.status(404).json({ error: 'Video not found' });
            }
            
            // Extract filename and construct proper cloud path
            let videoCloudPath;
            if (videoUrlToUse.includes('storage.googleapis.com')) {
                // Extract from full URL
                const urlParts = videoUrlToUse.split('/');
                const filename = urlParts.pop().split('?')[0];
                
                // Determine folder based on URL structure
                if (videoUrlToUse.includes('/clips/')) {
                    videoCloudPath = `clips/${filename}`;
                } else if (videoUrlToUse.includes('/videos/')) {
                    videoCloudPath = `videos/${filename}`;
                } else {
                    // Default to clips folder for generated clips
                    videoCloudPath = filename.includes('clip') ? `clips/${filename}` : `videos/${filename}`;
                }
            } else {
                // Direct filename - default to clips folder if it's a generated clip
                const filename = videoUrlToUse.split('/').pop().split('?')[0];
                videoCloudPath = generatedClipUrl ? `clips/${filename}` : `videos/${filename}`;
            }
            
            logger.info('Downloading video for reframe', { 
                transcriptId, 
                originalUrl: videoUrlToUse,
                isGeneratedClip: !!generatedClipUrl,
                cloudPath: videoCloudPath 
            });
            
            const videoFile = bucket.file(videoCloudPath);
            
            await videoFile.download({ destination: tempVideoPath });
            videoPath = tempVideoPath;
            
            // Get video dimensions from actual file metadata
            videoDimensions = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(videoPath, (err, metadata) => {
                    if (err) return reject(err);
                    
                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    resolve({
                        width: videoStream.width,
                        height: videoStream.height
                    });
                });
            });
        } else {
            videoPath = videoFile.path;
            
            // Extract video dimensions
            videoDimensions = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(videoPath, (err, metadata) => {
                    if (err) return reject(err);
                    
                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    resolve({
                        width: videoStream.width,
                        height: videoStream.height
                    });
                });
            });
        }
        
        const targetRatio = ASPECT_RATIOS[targetPlatform];
        const parsedDetections = typeof detections === 'string' ? JSON.parse(detections) : detections;
        
        logger.info('Detection input for crop calculation', {
            transcriptId,
            detectionsCount: parsedDetections?.length || 0,
            detections: parsedDetections?.slice(0, 5), // Log first 5 detections
            videoDimensions,
            targetRatio,
            hasValidDetections: parsedDetections?.some(d => 
                (d.boundingBox && d.boundingBox.left !== undefined) || 
                (d.x !== undefined && d.y !== undefined)
            )
        });
        
        // Calculate optimal crop parameters
        const cropParams = calculateOptimalCrop(parsedDetections, targetRatio, videoDimensions);
        
        // Generate preview frame from middle of the clip
        const previewTimestamp = 2; // 2 seconds into clip (works for both short and long clips)
            
        logger.info('Starting preview generation', { 
            transcriptId, 
            videoPath, 
            cropParams,
            previewTimestamp,
            isGeneratedClip: !!generatedClipUrl,
            fileExists: fs.existsSync(videoPath)
        });
        
        const previewPath = await generatePreviewFrame(videoPath, cropParams, previewTimestamp);
        
        // Upload preview to cloud storage
        const previewCloudPath = `previews/reframe_${Date.now()}.jpg`;
        await bucket.upload(previewPath, {
            destination: previewCloudPath,
            metadata: {
                cacheControl: 'public, max-age=3600'
            }
        });
        
        const previewUrl = `https://storage.googleapis.com/${bucket.name}/${previewCloudPath}`;
        
        // Cleanup temporary files
        try {
            fs.unlink(previewPath, () => {});
            if (transcriptId && videoPath && fs.existsSync(videoPath)) {
                fs.unlink(videoPath, () => {});
            }
        } catch (cleanupError) {
            logger.logError(cleanupError, { context: 'cleanup_error' });
        }
        
        logger.info('Reframe analysis completed', {
            targetPlatform,
            cropParams,
            detectionsCount: parsedDetections?.length || 0
        });
        
        res.json({
            success: true,
            analysis: {
                targetPlatform,
                targetRatio,
                originalDimensions: videoDimensions,
                cropParameters: cropParams,
                previewUrl,
                detectionsProcessed: parsedDetections?.length || 0
            },
            suggestions: {
                confidence: parsedDetections?.length > 0 ? 'high' : 'medium',
                reasoning: parsedDetections?.length > 0 ? 
                    `Found ${parsedDetections.length} subject(s) for optimal framing` :
                    'Using center crop as fallback - consider manual adjustment'
            }
        });
        
    } catch (error) {
        logger.logError(error, { 
            context: 'reframe_analysis', 
            transcriptId: req.body.transcriptId, 
            targetPlatform: req.body.targetPlatform 
        });
        res.status(500).json({
            error: 'Failed to analyze video for reframing',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Generate reframed video
 * POST /clips/reframe/generate
 */
router.post('/generate', async (req, res) => {
    try {
        const { 
            transcriptId, 
            targetPlatform, 
            cropParameters, 
            outputName,
            generatedClipUrl
        } = req.body;
        
        if (!transcriptId || !targetPlatform || !cropParameters) {
            return res.status(400).json({ 
                error: 'Transcript ID, target platform, and crop parameters are required' 
            });
        }
        
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript || !transcript.videoUrl) {
            return res.status(404).json({ error: 'Transcript or video not found' });
        }
        
        const targetRatio = ASPECT_RATIOS[targetPlatform];
        if (!targetRatio) {
            return res.status(400).json({ 
                error: 'Invalid target platform',
                supportedPlatforms: Object.keys(ASPECT_RATIOS)
            });
        }
        
        // Download the video (generated clip if provided, otherwise original video)
        const tempVideoPath = path.join('uploads/temp', `reframe_source_${transcriptId}_${Date.now()}.mp4`);
        
        // Use generated clip URL if provided, otherwise use original video
        const videoUrlToUse = generatedClipUrl || transcript.videoUrl;
        
        if (!videoUrlToUse) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        // Extract filename and construct proper cloud path
        let videoCloudPath;
        if (videoUrlToUse.includes('storage.googleapis.com')) {
            // Extract from full URL
            const urlParts = videoUrlToUse.split('/');
            const filename = urlParts.pop().split('?')[0];
            
            // Determine folder based on URL structure
            if (videoUrlToUse.includes('/clips/')) {
                videoCloudPath = `clips/${filename}`;
            } else if (videoUrlToUse.includes('/videos/')) {
                videoCloudPath = `videos/${filename}`;
            } else {
                // Default to clips folder for generated clips
                videoCloudPath = filename.includes('clip') ? `clips/${filename}` : `videos/${filename}`;
            }
        } else {
            // Direct filename - default to clips folder if it's a generated clip
            const filename = videoUrlToUse.split('/').pop().split('?')[0];
            videoCloudPath = generatedClipUrl ? `clips/${filename}` : `videos/${filename}`;
        }
        
        logger.info('Downloading video for reframe generation', { 
            transcriptId, 
            originalUrl: videoUrlToUse,
            isGeneratedClip: !!generatedClipUrl,
            cloudPath: videoCloudPath 
        });
        
        const videoFile = bucket.file(videoCloudPath);
        await videoFile.download({ destination: tempVideoPath });
        
        // Generate output filename - sanitize to remove invalid path characters
        const timestamp = Date.now(); // Use timestamp for uniqueness
        const baseFilename = transcript.originalFilename.replace(/\.[^.]+$/, '').replace(/[/\\:*?"<>|]/g, '_');
        const sanitizedOutputName = outputName ? 
            outputName.replace(/[/\\:*?"<>|]/g, '_') : 
            `${baseFilename}_${targetPlatform}_reframed_${timestamp}.mp4`;
        const outputFilename = sanitizedOutputName;
        const outputPath = path.join('uploads/temp', outputFilename);
        
        logger.info('Starting reframe generation', {
            transcriptId,
            targetPlatform,
            cropParameters,
            outputFilename,
            ffmpegCropFilter: `crop=${cropParameters.width}:${cropParameters.height}:${cropParameters.x}:${cropParameters.y}`
        });
        
        // Build FFmpeg command - no timing needed since we're processing the entire generated clip
        const command = ffmpeg(tempVideoPath)
            .videoFilters([
                `crop=${cropParameters.width}:${cropParameters.height}:${cropParameters.x}:${cropParameters.y}`
            ])
            .outputOptions([
                '-c:v libx264',
                '-crf 23',
                '-preset medium',
                '-c:a aac',
                '-b:a 128k'
            ]);
        
        // Process video
        await new Promise((resolve, reject) => {
            command
                .output(outputPath)
                .on('progress', (progress) => {
                    logger.info('Reframe progress', {
                        transcriptId,
                        percent: progress.percent,
                        timemark: progress.timemark
                    });
                })
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        
        // Upload reframed video to cloud storage
        const cloudPath = `clips/reframed/${outputFilename}`;
        await bucket.upload(outputPath, {
            destination: cloudPath,
            metadata: {
                cacheControl: 'public, max-age=86400',
                metadata: {
                    transcriptId,
                    targetPlatform,
                    originalVideo: transcript.originalFilename,
                    cropParameters: JSON.stringify(cropParameters)
                }
            }
        });
        
        const reframedUrl = `https://storage.googleapis.com/${bucket.name}/${cloudPath}`;
        
        // Cleanup temporary files
        fs.unlink(tempVideoPath, () => {});
        fs.unlink(outputPath, () => {});
        
        logger.info('Reframe generation completed', {
            transcriptId,
            targetPlatform,
            outputFilename,
            reframedUrl
        });
        
        res.json({
            success: true,
            reframedVideo: {
                filename: outputFilename,
                url: reframedUrl,
                platform: targetPlatform,
                platformName: targetRatio.name,
                aspectRatio: `${targetRatio.width}:${targetRatio.height}`,
                cropParameters,
                originalVideo: transcript.originalFilename,
                duration: null // Duration is the full generated clip
            }
        });
        
    } catch (error) {
        logger.logError(error, { context: 'reframe_generation' });
        res.status(500).json({
            error: 'Failed to generate reframed video',
            details: error.message
        });
    }
});

/**
 * Get supported platforms and their aspect ratios
 * GET /clips/reframe/platforms
 */
router.get('/platforms', (req, res) => {
    const platforms = Object.entries(ASPECT_RATIOS).map(([key, config]) => ({
        id: key,
        name: config.name,
        aspectRatio: `${config.width}:${config.height}`,
        width: config.width,
        height: config.height
    }));
    
    res.json({
        platforms,
        defaultPlatform: 'tiktok'
    });
});

/**
 * Manual crop adjustment endpoint
 * POST /clips/reframe/adjust
 */
router.post('/adjust', async (req, res) => {
    try {
        const { transcriptId, cropParameters, targetPlatform } = req.body;
        
        if (!transcriptId || !cropParameters || !targetPlatform) {
            return res.status(400).json({ 
                error: 'Transcript ID, crop parameters, and target platform are required' 
            });
        }
        
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript || !transcript.videoUrl) {
            return res.status(404).json({ error: 'Transcript or video not found' });
        }
        
        // Download video for preview generation
        const tempVideoPath = path.join('uploads/temp', `adjust_${transcriptId}_${Date.now()}.mp4`);
        
        // Extract filename and construct proper cloud path
        let videoCloudPath;
        if (transcript.videoUrl.includes('storage.googleapis.com')) {
            // Extract from full URL
            videoCloudPath = transcript.videoUrl.split('/').pop().split('?')[0];
            if (!videoCloudPath.startsWith('videos/')) {
                videoCloudPath = `videos/${videoCloudPath}`;
            }
        } else {
            // Direct filename - ensure it's in videos/ folder
            const filename = transcript.videoUrl.split('/').pop().split('?')[0];
            videoCloudPath = `videos/${filename}`;
        }
        
        const videoFile = bucket.file(videoCloudPath);
        await videoFile.download({ destination: tempVideoPath });
        
        // Generate new preview with adjusted crop
        const previewPath = await generatePreviewFrame(tempVideoPath, cropParameters);
        
        // Upload preview
        const previewCloudPath = `previews/adjusted_${Date.now()}.jpg`;
        await bucket.upload(previewPath, {
            destination: previewCloudPath,
            metadata: {
                cacheControl: 'public, max-age=3600'
            }
        });
        
        const previewUrl = `https://storage.googleapis.com/${bucket.name}/${previewCloudPath}`;
        
        // Cleanup
        fs.unlink(tempVideoPath, () => {});
        fs.unlink(previewPath, () => {});
        
        res.json({
            success: true,
            preview: {
                url: previewUrl,
                cropParameters,
                targetPlatform
            }
        });
        
    } catch (error) {
        logger.logError(error, { context: 'reframe_adjustment' });
        res.status(500).json({
            error: 'Failed to generate adjusted preview',
            details: error.message
        });
    }
});

module.exports = router;