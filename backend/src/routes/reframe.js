const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Transcript = require('../models/Transcript');
const logger = require('../utils/logger');
const axios = require('axios');
const { exec } = require('child_process'); // Added for shell script execution

const router = express.Router();

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

// Helper function to convert time format to seconds for SRT
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const minutes = parseInt(parts[0]);
    const seconds = parseInt(parts[1]);
    const milliseconds = parts[2] ? parseInt(parts[2]) : 0;
    return minutes * 60 + seconds + (milliseconds / 1000);
}

// Helper function to convert segment-level transcript to word-level for captions
function convertToWordLevel(segments) {
    const words = [];
    
    segments.forEach(segment => {
        const startTime = timeToSeconds(segment.start);
        const endTime = timeToSeconds(segment.end);
        const duration = endTime - startTime;
        const text = segment.text.trim();
        const wordsInSegment = text.split(/\s+/);
        
        // Distribute timing evenly across words in the segment
        const timePerWord = duration / wordsInSegment.length;
        
        wordsInSegment.forEach((word, index) => {
            const wordStart = startTime + (index * timePerWord);
            const wordEnd = wordStart + timePerWord;
            
            // Format back to MM:SS:mmm
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                const ms = Math.floor((seconds % 1) * 1000);
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
            };
            
            words.push({
                start: formatTime(wordStart),
                end: formatTime(wordEnd),
                text: word.replace(/[.,!?;]/g, ''), // Remove punctuation
                speaker: segment.speaker
            });
        });
    });
    
    return words;
}

// Helper function to build SRT subtitle content for reframe
function buildSRTContent(words) {
    if (!Array.isArray(words) || words.length === 0) {
        return '';
    }
    
    // Group words into phrases to reduce the number of subtitle entries
    const phrases = [];
    let currentPhrase = [];
    let phraseStart = null;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        if (!word || !word.start || !word.end || !word.text) {
            continue;
        }
        
        if (phraseStart === null) {
            phraseStart = word.start;
        }
        
        currentPhrase.push(word.text);
        
        // End phrase after 3-5 words or at natural breaks
        const shouldEndPhrase = currentPhrase.length >= 4 || 
                               word.text.match(/[.!?]$/) ||
                               i === words.length - 1;
        
        if (shouldEndPhrase) {
            phrases.push({
                start: phraseStart,
                end: word.end,
                text: currentPhrase.join(' ')
            });
            currentPhrase = [];
            phraseStart = null;
        }
    }
    
    // Convert phrases to SRT format
    let srtContent = '';
    phrases.forEach((phrase, index) => {
        const startTime = convertToSRTTime(phrase.start);
        const endTime = convertToSRTTime(phrase.end);
        
        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${phrase.text}\n\n`;
    });
    
    return srtContent;
}

// Helper function to convert time format to SRT format (HH:MM:SS,mmm)
function convertToSRTTime(timeStr) {
    const parts = timeStr.split(':');
    let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
    
    if (parts.length === 3) {
        minutes = parseInt(parts[0]);
        seconds = parseInt(parts[1]);
        milliseconds = parseInt(parts[2]) || 0;
    } else if (parts.length === 2) {
        minutes = parseInt(parts[0]);
        seconds = parseInt(parts[1]);
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Helper function to convert color to ASS format for captions
function convertColorToASS(color) {
    if (color === 'white') return '&H00FFFFFF';
    if (color === 'black') return '&H00000000';
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `&H00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    return '&H00FFFFFF';
}

/**
 * Build caption SRT file for FFmpeg reframe
 * @param {Array} segments - Array of transcript segments  
 * @param {string} style - Caption style ID
 * @returns {string} Path to generated SRT file or null
 */
function buildCaptionFilter(segments, style) {
    // Caption style configurations
    const CAPTION_STYLES = {
        'bold-center': {
            fontsize: 48,
            fontcolor: 'white',
            borderw: 3,
            bordercolor: 'black'
        },
        'neon-pop': {
            fontsize: 52,
            fontcolor: '#FF6B9D',
            borderw: 2,
            bordercolor: '#FFD93D'
        },
        'typewriter': {
            fontsize: 44,
            fontcolor: 'white',
            borderw: 2,
            bordercolor: 'black'
        },
        'bubble': {
            fontsize: 46,
            fontcolor: 'white',
            borderw: 4,
            bordercolor: '#4ECDC4'
        },
        'minimal-clean': {
            fontsize: 42,
            fontcolor: 'white',
            borderw: 1,
            bordercolor: 'black'
        }
    };

    const styleConfig = CAPTION_STYLES[style];
    if (!styleConfig) return null;

    try {
        // Convert segment-level transcript to word-level if needed
        let words;
        if (segments && segments.length > 0) {
            const firstSegment = segments[0];
            const isWordLevel = firstSegment.text && firstSegment.text.split(/\s+/).length === 1;
            
            if (isWordLevel) {
                words = segments;
            } else {
                words = convertToWordLevel(segments);
            }
        } else {
            return null;
        }

        // Generate SRT content
        const srtContent = buildSRTContent(words);
        if (!srtContent) return null;

        // Create temporary SRT file
        const tempDir = 'uploads/temp/';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const srtFilename = `reframe_captions_${Date.now()}.srt`;
        const srtPath = path.join(tempDir, srtFilename);
        
        fs.writeFileSync(srtPath, srtContent);
        
        console.log(`Created SRT file for reframe: ${srtPath} with ${words.length} words`);
        
        return srtPath;
        
    } catch (error) {
        console.error('Error building caption filter:', error);
        return null;
    }
}

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
    
    // Different padding strategies based on aspect ratio
    const isVertical = targetAspect < 1; // 9:16, stories
    const isSquare = Math.abs(targetAspect - 1) < 0.1; // 1:1
    
    // Adjust padding factors for different formats
    let PADDING_FACTOR, VERTICAL_EXPANSION_FACTOR;
    
    if (isVertical) {
        PADDING_FACTOR = 1.2;
        VERTICAL_EXPANSION_FACTOR = 2.5;
    } else if (isSquare) {
        PADDING_FACTOR = 1.8;
        VERTICAL_EXPANSION_FACTOR = 1.8;
    } else {
        PADDING_FACTOR = 1.6;
        VERTICAL_EXPANSION_FACTOR = 1.4;
    }

    logger.info('Starting smart crop calculation', {
        videoWidth,
        videoHeight,
        targetAspect,
        detectionsCount: detections?.length || 0,
    });

    let subjectBounds = {
        minX: videoWidth,
        maxX: 0,
        minY: videoHeight,
        maxY: 0,
        isValid: false
    };

    // --- ROBUST DETECTION PARSING ---
    if (detections && detections.length > 0) {
        detections.forEach(d => {
            let box;
            // Handle multiple common face detection formats
            if (d.box) { // TensorFlow.js format { box: { xMin, yMin, width, height } }
                 box = { x: d.box.xMin, y: d.box.yMin, width: d.box.width, height: d.box.height };
            } else if (d.boundingBox) { // MediaPipe format { boundingBox: { left, top, width, height } } (relative)
                 box = { x: d.boundingBox.left * videoWidth, y: d.boundingBox.top * videoHeight, width: d.boundingBox.width * videoWidth, height: d.boundingBox.height * videoHeight };
            }

            if (box) {
                subjectBounds.minX = Math.min(subjectBounds.minX, box.x);
                subjectBounds.maxX = Math.max(subjectBounds.maxX, box.x + box.width);
                subjectBounds.minY = Math.min(subjectBounds.minY, box.y);
                subjectBounds.maxY = Math.max(subjectBounds.maxY, box.y + box.height);
                subjectBounds.isValid = true;
            }
        });
    }

    let cropWidth, cropHeight, cropX, cropY;

    if (subjectBounds.isValid) {
        logger.info('Valid subject bounds calculated', { subjectBounds });
        
        const contentWidth = subjectBounds.maxX - subjectBounds.minX;
        const contentHeight = subjectBounds.maxY - subjectBounds.minY;
        const contentCenterX = subjectBounds.minX + contentWidth / 2;
        const contentCenterY = subjectBounds.minY + contentHeight / 2;
        
        if (isVertical) {
            // Special handling for 9:16 videos
            const paddedWidth = contentWidth * PADDING_FACTOR;
            const estimatedHeadY = subjectBounds.minY - (contentHeight * 0.3);
            const upperBodyBottomY = subjectBounds.maxY + (contentHeight * 1.2);
            const availableHeightForSubject = upperBodyBottomY - estimatedHeadY;
            
            const requiredHeightForWidth = paddedWidth / targetAspect;

            if (requiredHeightForWidth <= availableHeightForSubject * 1.2) {
                cropWidth = paddedWidth;
                cropHeight = cropWidth / targetAspect;
                const idealCenterY = (estimatedHeadY + upperBodyBottomY) / 2;
                cropY = idealCenterY - cropHeight / 2;
                cropX = contentCenterX - cropWidth / 2;
            } else {
                cropHeight = Math.min(availableHeightForSubject * 1.1, videoHeight * 0.85);
                cropWidth = cropHeight * targetAspect;
                cropY = Math.max(0, estimatedHeadY - (cropHeight * 0.15));
                cropX = contentCenterX - cropWidth / 2;
            }
            
        } else {
            // Original logic for square and landscape
            let paddedWidth = contentWidth * PADDING_FACTOR;
            let paddedHeight = contentHeight * VERTICAL_EXPANSION_FACTOR;

            if (paddedWidth / paddedHeight > targetAspect) {
                cropWidth = paddedWidth;
                cropHeight = cropWidth / targetAspect;
            } else {
                cropHeight = paddedHeight;
                cropWidth = cropHeight * targetAspect;
            }

            cropX = contentCenterX - cropWidth / 2;
            cropY = contentCenterY - cropHeight / 2;
        }

    } else {
        logger.warn('No valid detections found, falling back to center crop.');
        const videoAspect = videoWidth / videoHeight;
        if (videoAspect > targetAspect) {
            cropHeight = videoHeight * 0.9;
            cropWidth = cropHeight * targetAspect;
        } else {
            cropWidth = videoWidth * 0.9;
            cropHeight = cropWidth / targetAspect;
        }
        cropX = (videoWidth - cropWidth) / 2;
        cropY = (videoHeight - cropHeight) / 2;
    }

    // Safety constraints
    cropWidth = Math.min(cropWidth, videoWidth);
    cropHeight = Math.min(cropHeight, videoHeight);
    
    cropX = Math.max(0, Math.min(cropX, videoWidth - cropWidth));
    cropY = Math.max(0, Math.min(cropY, videoHeight - cropHeight));

    if (isVertical && cropY + cropHeight > videoHeight) {
        cropY = Math.max(0, videoHeight - cropHeight);
    }
    
    const finalWidth = Math.floor(cropWidth / 2) * 2;
    const finalHeight = Math.floor(cropHeight / 2) * 2;
    const finalX = Math.floor(cropX / 2) * 2;
    const finalY = Math.floor(cropY / 2) * 2;

    const result = {
        width: finalWidth,
        height: finalHeight,
        x: finalX,
        y: finalY,
        centerX: Math.round(finalX + finalWidth / 2),
        centerY: Math.round(finalY + finalHeight / 2),
        zoomFactor: videoWidth / finalWidth
    };
    
    logger.info('Smart crop calculation complete', { result });

    return result;
}

/**
 * Generates a dynamic FFmpeg crop filter string that changes based on speaker timestamps.
 * This function creates "hard cuts" between speakers.
 * @param {Array} transcriptSegments - The transcript data with speaker and timing info.
 * @param {Array} detections - The face detection data.
 * @param {Object} targetRatio - The target aspect ratio configuration.
 * @param {Object} videoDimensions - The original video width and height.
 * @returns {String|null} A dynamic FFmpeg filter string or null if it cannot be generated.
 */
function generateDirectorCutFilter(transcriptSegments, detections, targetRatio, videoDimensions) {
    if (!transcriptSegments || transcriptSegments.length === 0 || !detections || detections.length === 0) {
        logger.warn('Cannot generate director cut filter: missing transcript or detections.');
        return null;
    }

    // 1. Map Speakers to Faces
    const faces = detections
        .map(d => d.boundingBox ? { ...d.boundingBox, ...d } : null)
        .filter(Boolean)
        .sort((a, b) => a.left - b.left); // Sort faces from left to right on screen

    const speakerLabels = [...new Set(transcriptSegments.map(s => s.speaker))].sort();
    const speakerFaceMap = {};
    speakerLabels.forEach((label, index) => {
        if (faces[index]) {
            speakerFaceMap[label] = faces[index];
        }
    });

    logger.info('Speaker to face mapping created', { speakerFaceMap });
    
    // 2. Generate crop parameters for each speaker and a default wide shot
    const individualCropParams = {};
    for (const speaker in speakerFaceMap) {
        const face = speakerFaceMap[speaker];
        // Create a fake detection array with just one face to reuse our smart crop logic
        individualCropParams[speaker] = calculateOptimalCrop([face], targetRatio, videoDimensions);
    }
    // Default wide shot that contains all detected faces
    individualCropParams['default'] = calculateOptimalCrop(detections, targetRatio, videoDimensions);

    // 3. Build the time-based filter expressions
    let wExpr = '', hExpr = '', xExpr = '', yExpr = '';
    const fallback = individualCropParams['default'];

    transcriptSegments.forEach(segment => {
        const params = individualCropParams[segment.speaker] || fallback;
        const start = parseFloat(segment.start.split(':').reduce((acc, time) => (60 * acc) + +time, 0));
        const end = parseFloat(segment.end.split(':').reduce((acc, time) => (60 * acc) + +time, 0));

        wExpr += `if(between(t,${start},${end}),${params.width},`;
        hExpr += `if(between(t,${start},${end}),${params.height},`;
        xExpr += `if(between(t,${start},${end}),${params.x},`;
        yExpr += `if(between(t,${start},${end}),${params.y},`;
    });
    
    wExpr += `${fallback.width}` + ')'.repeat(transcriptSegments.length);
    hExpr += `${fallback.height}` + ')'.repeat(transcriptSegments.length);
    xExpr += `${fallback.x}` + ')'.repeat(transcriptSegments.length);
    yExpr += `${fallback.y}` + ')'.repeat(transcriptSegments.length);

    const filterString = `crop=w='${wExpr}':h='${hExpr}':x='${xExpr}':y='${yExpr}'`;
    
    logger.info('Generated dynamic director cut filter string.', { length: filterString.length });

    return filterString;
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
            
            const videoUrlToUse = generatedClipUrl || transcript.videoUrl;
            if (!videoUrlToUse) {
                return res.status(404).json({ error: 'Video not found' });
            }

            // If it's a generated clip, the full path is in the URL. Otherwise, use basename.
            if (generatedClipUrl) {
                videoPath = path.join(__dirname, '..', '..', videoUrlToUse.substring(1));
            } else {
                videoPath = path.join(__dirname, '..', '..', 'uploads', path.basename(videoUrlToUse));
            }
            
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
        
        const previewFileName = `reframe_${Date.now()}.jpg`;
        const previewDestPath = path.join('uploads', 'previews', previewFileName);
        fs.mkdirSync(path.dirname(previewDestPath), { recursive: true });
        fs.renameSync(previewPath, previewDestPath);
        const previewUrl = `/uploads/previews/${previewFileName}`;
        
        // Cleanup temporary preview file
        try {
            fs.unlink(previewPath, () => {});
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
            generatedClipUrl,
            captions
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
        const videoUrlToUse = generatedClipUrl || transcript.videoUrl;
        if (!videoUrlToUse) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        let tempVideoPath;
        if (generatedClipUrl) {
            tempVideoPath = path.join(__dirname, '..', '..', videoUrlToUse.substring(1));
        } else {
            tempVideoPath = path.join(__dirname, '..', '..', 'uploads', path.basename(videoUrlToUse));
        }
        
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
        
        // Build video filters
        let srtPath = null;
        let finalFilter;
        let cropFilter;
        
        // --- Dynamic Director Cut Logic ---
        if (captions && captions.enabled && transcript.transcript && req.body.detections) {
            logger.info('Attempting to generate Director Cut filter.');
            const directorFilter = generateDirectorCutFilter(transcript.transcript, req.body.detections, targetRatio, videoDimensions);
            if (directorFilter) {
                finalFilter = directorFilter;
                logger.info('Using dynamic Director Cut filter.');
            } else {
                logger.warn('Fallback to static crop: Director Cut filter could not be generated.');
                cropFilter = `crop=${cropParameters.width}:${cropParameters.height}:${cropParameters.x}:${cropParameters.y}`;
            }
        } else {
            logger.info('Using static crop filter.');
            cropFilter = `crop=${cropParameters.width}:${cropParameters.height}:${cropParameters.x}:${cropParameters.y}`;
        }


        // Captioning logic
        if (captions && captions.enabled) {
            const transcript = await Transcript.findById(transcriptId);
            if (transcript && transcript.transcript && transcript.transcript.length > 0) {
                srtPath = buildCaptionFilter(transcript.transcript, captions.style);
                if (srtPath) {
                    console.log(`Using SRT file for captions: ${srtPath}`);
                    // Add subtitle filter to video filters
                    const styleConfig = {
                        'bold-center': { fontsize: 48, fontcolor: 'white', borderw: 3, bordercolor: 'black' },
                        'neon-pop': { fontsize: 52, fontcolor: '#FF6B9D', borderw: 2, bordercolor: '#FFD93D' },
                        'typewriter': { fontsize: 44, fontcolor: 'white', borderw: 2, bordercolor: 'black' },
                        'bubble': { fontsize: 46, fontcolor: 'white', borderw: 4, bordercolor: '#4ECDC4' },
                        'minimal-clean': { fontsize: 42, fontcolor: 'white', borderw: 1, bordercolor: 'black' }
                    };
                    
                    const style = styleConfig[captions.style] || styleConfig['bold-center'];
                    const subtitleFilter = `subtitles=${srtPath}:force_style='FontName=Arial,FontSize=${style.fontsize},PrimaryColour=${convertColorToASS(style.fontcolor)},OutlineColour=${convertColorToASS(style.bordercolor)},Outline=${style.borderw},Alignment=2,MarginV=80'`;
                    finalFilter = finalFilter ? `${finalFilter},${subtitleFilter}` : subtitleFilter;
                }
            }
        }

        // Build FFmpeg command - no timing needed since we're processing the entire generated clip
        const command = ffmpeg(tempVideoPath)
            .videoFilters(finalFilter ? [finalFilter] : [cropFilter])
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
                .on('error', (err) => {
                    // Cleanup SRT file on error
                    if (srtPath) {
                        fs.unlink(srtPath, () => {});
                    }
                    reject(err);
                })
                .run();
        });
        
        const reframedDestPath = path.join('uploads', 'clips', 'reframed', outputFilename);
        fs.mkdirSync(path.dirname(reframedDestPath), { recursive: true });
        fs.renameSync(outputPath, reframedDestPath);
        const reframedUrl = `/uploads/clips/reframed/${outputFilename}`;
        
        // Cleanup temporary files
        fs.unlink(tempVideoPath, () => {});
        fs.unlink(outputPath, () => {});
        
        // Cleanup SRT file if it was created
        if (srtPath) {
            fs.unlink(srtPath, (err) => {
                if (err) console.warn('Failed to cleanup SRT file:', err.message);
                else console.log('SRT file cleaned up successfully');
            });
        }
        
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
        const tempVideoPath = path.join(__dirname, '..', '..', 'uploads', path.basename(transcript.videoUrl));
        
        // Generate new preview with adjusted crop
        const previewPath = await generatePreviewFrame(tempVideoPath, cropParameters);
        
        const previewFileName = `adjusted_${Date.now()}.jpg`;
        const previewDestPath = path.join('uploads', 'previews', previewFileName);
        fs.mkdirSync(path.dirname(previewDestPath), { recursive: true });
        fs.renameSync(previewPath, previewDestPath);
        const previewUrl = `/uploads/previews/${previewFileName}`;
        
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

/**
 * Process streamer + gameplay crop
 * POST /clips/reframe/streamer-gameplay
 */
router.post('/streamer-gameplay', async (req, res) => {
  try {
    const { 
      transcriptId, 
      webcamArea, 
      gameplayArea, 
      webcamScale, 
      webcamPosition,
      outputName 
    } = req.body;
    
    if (!transcriptId || !webcamArea || !gameplayArea) {
      return res.status(400).json({ 
        error: 'Transcript ID, webcam area, and gameplay area are required' 
      });
    }
    
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    // Create temporary directories
    const tempDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create temporary file paths with fixed naming for debugging
    const timestamp = Date.now();
    const sourceVideoPath = path.join(__dirname, '..', '..', 'uploads', path.basename(transcript.videoUrl));
    const tempWebcamPath = path.join(tempDir, `webcam_${timestamp}.mp4`);
    const tempGameplayPath = path.join(tempDir, `gameplay_${timestamp}.mp4`);
    const finalOutputPath = path.join(tempDir, `final_${timestamp}.mp4`);
    const outputFilename = outputName || `streamer_gameplay_${timestamp}.mp4`;
    const publicOutputPath = path.join(tempDir, outputFilename);
    
    logger.info('Starting streamer gameplay processing', { 
      transcriptId,
      sourceVideoPath
    });
    
    // Get video duration
    const videoDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(sourceVideoPath, (err, metadata) => {
        if (err) return reject(err);
        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
    
    logger.info('Video duration:', { videoDuration });
    
    // Step 1: Extract webcam area
    logger.info('Extracting webcam area', { webcamArea });
    await new Promise((resolve, reject) => {
      ffmpeg(sourceVideoPath)
        .outputOptions([
          '-c:v libx264',
          '-crf 23',
          '-preset ultrafast'
        ])
        .videoFilters([
          `crop=${webcamArea.width}:${webcamArea.height}:${webcamArea.x}:${webcamArea.y}`
        ])
        .noAudio()
        .output(tempWebcamPath)
        .on('end', resolve)
        .on('error', (err) => {
          logger.error('Webcam extraction error:', err.message);
          reject(err);
        })
        .run();
    });
    
    // Step 2: Extract gameplay area
    logger.info('Extracting gameplay area', { gameplayArea });
    await new Promise((resolve, reject) => {
      ffmpeg(sourceVideoPath)
        .outputOptions([
          '-c:v libx264',
          '-crf 23',
          '-preset ultrafast'
        ])
        .videoFilters([
          `crop=${gameplayArea.width}:${gameplayArea.height}:${gameplayArea.x}:${gameplayArea.y}`
        ])
        .noAudio()
        .output(tempGameplayPath)
        .on('end', resolve)
        .on('error', (err) => {
          logger.error('Gameplay extraction error:', err.message);
          reject(err);
        })
        .run();
    });
    
    // Calculate output dimensions for 9:16 aspect ratio
    const outputWidth = 720; // Reduced for better performance
    const outputHeight = 1280; // 9:16 ratio
    
    // Calculate webcam and gameplay heights
    const webcamHeight = Math.round((outputHeight * webcamScale) / 100);
    const webcamY = Math.round((outputHeight * webcamPosition) / 100);
    const gameplayY = webcamY + webcamHeight;
    
    // Step 3: Combine the videos
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(tempGameplayPath)
            .input(tempWebcamPath)
            .input(sourceVideoPath) // for audio
            .complexFilter([
                `[0:v]scale=${outputWidth}:-1[gameplay]`,
                `[1:v]scale=${outputWidth}:${webcamHeight}[webcam]`,
                `color=black:s=${outputWidth}x${outputHeight}:d=${videoDuration}[bg]`,
                `[bg][gameplay]overlay=0:${gameplayY}[tmp]`,
                `[tmp][webcam]overlay=0:${webcamY}`
            ])
            .outputOptions([
                '-map', '2:a',
                '-c:v', 'libx264',
                '-crf', '23',
                '-preset', 'medium',
                '-c:a', 'aac',
                '-b:a', '128k'
            ])
            .output(finalOutputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
    
    const destDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const destPath = path.join(destDir, outputFilename);
    fs.renameSync(finalOutputPath, destPath);
    const processedVideoUrl = `/uploads/temp/${outputFilename}`;
    
    res.json({
      success: true,
      processedVideoUrl,
      outputName: outputFilename
    });
    
  } catch (error) {
    logger.error(error.message, { context: 'streamer_gameplay_processing', stack: error.stack });
    res.status(500).json({
      error: 'Failed to process streamer + gameplay video',
      details: error.message
    });
  }
});

/**
 * Download a processed video file directly
 * GET /clips/download/:filename
 */
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join('uploads/temp', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Set headers for download
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Type', 'video/mp4');
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Serve static files from uploads/temp directory
router.use('/temp', express.static(path.join(__dirname, '../../uploads/temp')));

module.exports = router;