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
    
    logger.info('Starting crop calculation', {
        videoWidth,
        videoHeight,
        targetAspect,
        targetRatioConfig: targetRatio,
        detectionsCount: detections?.length || 0
    });
    
    // Find the center point of all detected subjects
    // Prioritize high-confidence detections and those closer to the preview timestamp
    let subjectCenterX = 0.5; // Default to center
    let subjectCenterY = 0.4; // Default slightly up from center
    let hasDetections = false;
    
    if (detections && detections.length > 0) {
        let weightedX = 0;
        let weightedY = 0;
        let totalWeight = 0;
        
        detections.forEach(detection => {
            let centerX, centerY;
            
            if (detection.boundingBox) {
                // Face detection bounding box is in PIXEL coordinates - need to normalize
                const pixelCenterX = detection.boundingBox.left + detection.boundingBox.width / 2;
                const pixelCenterY = detection.boundingBox.top + detection.boundingBox.height / 2;
                
                // Normalize to 0-1 range
                centerX = pixelCenterX / videoWidth;
                centerY = pixelCenterY / videoHeight;
                hasDetections = true;
                
                logger.info('Face detection normalized', {
                    originalPixelCenter: { x: pixelCenterX, y: pixelCenterY },
                    normalizedCenter: { x: centerX, y: centerY },
                    videoDimensions: { width: videoWidth, height: videoHeight }
                });
            } else if (detection.x !== undefined && detection.y !== undefined) {
                // Pose points are already normalized (0-1)
                centerX = detection.x;
                centerY = detection.y;
                hasDetections = true;
            }
            
            if (centerX !== undefined && centerY !== undefined) {
                // Ensure coordinates are valid
                centerX = Math.max(0, Math.min(1, centerX));
                centerY = Math.max(0, Math.min(1, centerY));
                
                // Weight by confidence - higher confidence detections have more influence
                const weight = Math.max(detection.confidence || 0.5, 0.1);
                
                weightedX += centerX * weight;
                weightedY += centerY * weight;
                totalWeight += weight;
                
                logger.info('Detection processed', {
                    type: detection.type,
                    centerX,
                    centerY,
                    confidence: detection.confidence,
                    weight,
                    rawDetection: detection.boundingBox || { x: detection.x, y: detection.y }
                });
            }
        });
        
        if (totalWeight > 0) {
            subjectCenterX = weightedX / totalWeight;
            subjectCenterY = weightedY / totalWeight;
            
            logger.info('Calculated WEIGHTED subject center FROM DETECTIONS', {
                subjectCenterX,
                subjectCenterY,
                totalWeight,
                detectionCount: detections.length,
                usingDetectedSubjects: true
            });
        } else {
            logger.warn('NO VALID DETECTIONS - Using fallback center', {
                fallbackX: subjectCenterX,
                fallbackY: subjectCenterY,
                usingDetectedSubjects: false
            });
        }
    }
    
    // Calculate crop dimensions to fit target aspect ratio
    // Determine which dimension to constrain based on video aspect vs target aspect
    const videoAspect = videoWidth / videoHeight;
    
    let cropWidth, cropHeight;
    
    // Start with maximum safe dimensions (85% to ensure we stay well within bounds)
    const maxSafeRatio = 0.85;
    
    if (videoAspect > targetAspect) {
        // Video is wider than target - constrain by height
        cropHeight = maxSafeRatio;
        cropWidth = cropHeight * targetAspect;
        
        // Ensure width doesn't exceed safe bounds
        if (cropWidth > maxSafeRatio) {
            cropWidth = maxSafeRatio;
            cropHeight = cropWidth / targetAspect;
        }
    } else {
        // Video is taller than target or same aspect - constrain by width
        cropWidth = maxSafeRatio;
        cropHeight = cropWidth / targetAspect;
        
        // Ensure height doesn't exceed safe bounds
        if (cropHeight > maxSafeRatio) {
            cropHeight = maxSafeRatio;
            cropWidth = cropHeight * targetAspect;
        }
    }
    
    // Double-check that both dimensions are within safe bounds
    cropWidth = Math.min(cropWidth, maxSafeRatio);
    cropHeight = Math.min(cropHeight, maxSafeRatio);
    
    logger.info('Crop dimensions calculated', {
        videoAspect,
        targetAspect,
        cropWidth,
        cropHeight,
        actualCropAspect: cropWidth / cropHeight
    });
    
    // Position the crop centered on the subject
    let cropX = subjectCenterX - cropWidth / 2;
    let cropY = subjectCenterY - cropHeight / 2;
    
    // For vertical videos (like TikTok), position subject slightly higher in frame
    if (targetAspect < 1) {
        cropY = subjectCenterY - cropHeight * 0.4; // Position subject 40% from top
    }
    
    // Ensure crop stays within video bounds
    if (cropX < 0) cropX = 0;
    if (cropY < 0) cropY = 0;
    if (cropX + cropWidth > 1) cropX = 1 - cropWidth;
    if (cropY + cropHeight > 1) cropY = 1 - cropHeight;
    
    // Convert to pixel coordinates (ensure even numbers for video encoding)
    let pixelWidth = Math.floor(cropWidth * videoWidth / 2) * 2;
    let pixelHeight = Math.floor(cropHeight * videoHeight / 2) * 2;
    let pixelX = Math.floor(cropX * videoWidth / 2) * 2;
    let pixelY = Math.floor(cropY * videoHeight / 2) * 2;
    
    // Additional safety checks for pixel dimensions
    pixelWidth = Math.min(pixelWidth, videoWidth - 4); // Leave 4px margin
    pixelHeight = Math.min(pixelHeight, videoHeight - 4); // Leave 4px margin
    pixelX = Math.min(pixelX, videoWidth - pixelWidth);
    pixelY = Math.min(pixelY, videoHeight - pixelHeight);
    
    // Ensure minimum dimensions (for encoding compatibility)
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
            // Too wide, reduce width
            pixelWidth = Math.floor(pixelHeight * targetAspect / 2) * 2;
        } else {
            // Too tall, reduce height
            pixelHeight = Math.floor(pixelWidth / targetAspect / 2) * 2;
        }
    }
    
    // Final validation - ensure coordinates are within video bounds
    pixelX = Math.max(0, Math.min(pixelX, videoWidth - pixelWidth));
    pixelY = Math.max(0, Math.min(pixelY, videoHeight - pixelHeight));
    
    logger.info('Final pixel dimensions', {
        pixelWidth,
        pixelHeight,
        finalAspect: pixelWidth / pixelHeight,
        targetAspect
    });
    
    const result = {
        width: pixelWidth,
        height: pixelHeight,
        x: pixelX,
        y: pixelY,
        centerX: Math.round(subjectCenterX * videoWidth),
        centerY: Math.round(subjectCenterY * videoHeight),
        zoomFactor: 1.0 / Math.max(cropWidth, cropHeight)
    };
    
    logger.info('Final crop calculation result', {
        videoDimensions,
        targetAspect,
        subjectCenter: { x: subjectCenterX, y: subjectCenterY },
        cropDimensions: { width: cropWidth, height: cropHeight },
        cropPosition: { x: cropX, y: cropY },
        pixelResult: result,
        hasDetections
    });
    
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
            const safetyMargin = 2; // 2 pixel safety margin
            if (cropParams.x + cropParams.width > videoWidth - safetyMargin || 
                cropParams.y + cropParams.height > videoHeight - safetyMargin ||
                cropParams.x < 0 || cropParams.y < 0) {
                
                logger.logError(new Error('Crop parameters exceed video dimensions'), {
                    context: 'crop_validation',
                    videoWidth,
                    videoHeight,
                    cropParams,
                    safetyMargin
                });
                return reject(new Error('Crop parameters exceed video dimensions'));
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
        logger.logError(error, { context: 'reframe_analysis', transcriptId, targetPlatform });
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