const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Transcript = require('../models/Transcript');
const logger = require('../utils/logger');

const router = express.Router();

const upload = multer({
    dest: 'uploads/temp/',
    limits: { fileSize: 100 * 1024 * 1024 }
});

const ASPECT_RATIOS = {
    'tiktok': { width: 9, height: 16, name: 'TikTok/Shorts' },
    'instagram': { width: 1, height: 1, name: 'Instagram Square' },
    'youtube': { width: 16, height: 9, name: 'YouTube Landscape' },
    'story': { width: 9, height: 16, name: 'Instagram/Facebook Story' }
};

// --- Time Conversion Helpers ---
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    const milliseconds = parseInt(parts[2]) || 0;
    return minutes * 60 + seconds + (milliseconds / 1000);
}

// --- Smart Cropping Logic ---

/**
 * Calculates an optimal 9:16 crop window for a single face.
 * @param {object} face - A single face detection object with a boundingBox.
 * @param {object} videoDimensions - The original video's width and height.
 * @returns {object} The calculated crop parameters {x, y, width, height}.
 */
function calculateCropForFace(face, videoDimensions) {
    const { width: videoWidth, height: videoHeight } = videoDimensions;
    const targetAspect = 9 / 16;

    // Increased padding for a more cinematic, less tight shot
    const PADDING_FACTOR = 2.5; 

    const faceWidth = face.boundingBox.width * videoWidth;
    const faceHeight = face.boundingBox.height * videoHeight;
    const faceCenterX = (face.boundingBox.left * videoWidth) + (faceWidth / 2);
    const faceCenterY = (face.boundingBox.top * videoHeight) + (faceHeight / 2);

    let cropHeight, cropWidth, cropX, cropY;

    // Determine crop dimensions based on face height and padding
    cropHeight = Math.min(faceHeight * PADDING_FACTOR, videoHeight);
    cropWidth = cropHeight * targetAspect;

    // Center the crop on the face, with a slight vertical offset for headroom
    cropX = faceCenterX - cropWidth / 2;
    cropY = faceCenterY - cropHeight / 2 - (faceHeight * 0.2);

    // Ensure the crop window stays within the video boundaries
    cropWidth = Math.min(cropWidth, videoWidth);
    cropHeight = Math.min(cropHeight, videoHeight);
    cropX = Math.max(0, Math.min(cropX, videoWidth - cropWidth));
    cropY = Math.max(0, Math.min(cropY, videoHeight - cropHeight));

    // Return dimensions rounded to the nearest even number for FFmpeg compatibility
    return {
        width: Math.floor(cropWidth / 2) * 2,
        height: Math.floor(cropHeight / 2) * 2,
        x: Math.floor(cropX / 2) * 2,
        y: Math.floor(cropY / 2) * 2,
    };
}

/**
 * Generates a dynamic FFmpeg filter to follow the active person on screen.
 * @param {Array} allDetections - Array of all face detections from the frontend.
 * @param {object} videoDimensions - The original video's width and height.
 * @returns {string|null} The complex FFmpeg filter string.
 */
function generateVisualDirectorFilter(allDetections, videoDimensions) {
    if (!allDetections || allDetections.length === 0) {
        logger.warn('Cannot generate visual director cut: no detections provided.');
        return null;
    }

    // 1. Group detections by timestamp
    const detectionsByTime = allDetections.reduce((acc, detection) => {
        const time = detection.time.toFixed(1); // Group by 100ms intervals
        if (!acc[time]) acc[time] = [];
        acc[time].push(detection);
        return acc;
    }, {});

    // 2. Determine the "protagonist" (most central face) for each timestamp
    const protagonistTimeline = Object.entries(detectionsByTime).map(([time, detections]) => {
        let protagonist = detections[0];
        if (detections.length > 1) {
            // Find the face closest to the center of the frame
            protagonist = detections.reduce((prev, curr) => {
                const prevCenterDist = Math.abs(0.5 - (prev.boundingBox.left + prev.boundingBox.width / 2));
                const currCenterDist = Math.abs(0.5 - (curr.boundingBox.left + curr.boundingBox.width / 2));
                return currCenterDist < prevCenterDist ? curr : prev;
            });
        }
        return { time: parseFloat(time), id: protagonist.id, detection: protagonist };
    });

    // 3. Create "scenes" based on who the protagonist is
    const scenes = [];
    if (protagonistTimeline.length > 0) {
        let currentScene = { id: protagonistTimeline[0].id, startTime: protagonistTimeline[0].time, detections: [] };
        protagonistTimeline.forEach((p, i) => {
            if (p.id !== currentScene.id) {
                currentScene.endTime = p.time;
                scenes.push(currentScene);
                currentScene = { id: p.id, startTime: p.time, detections: [p.detection] };
            } else {
                currentScene.detections.push(p.detection);
            }
        });
        currentScene.endTime = protagonistTimeline[protagonistTimeline.length - 1].time;
        scenes.push(currentScene);
    }

    // 4. Calculate the average, stable crop for each scene
    const sceneCrops = scenes.map(scene => {
        const avgX = scene.detections.reduce((sum, d) => sum + d.boundingBox.left, 0) / scene.detections.length;
        const avgY = scene.detections.reduce((sum, d) => sum + d.boundingBox.top, 0) / scene.detections.length;
        const avgW = scene.detections.reduce((sum, d) => sum + d.boundingBox.width, 0) / scene.detections.length;
        const avgH = scene.detections.reduce((sum, d) => sum + d.boundingBox.height, 0) / scene.detections.length;
        
        const avgDetection = { boundingBox: { left: avgX, top: avgY, width: avgW, height: avgH }};
        return {
            ...scene,
            crop: calculateCropForFace(avgDetection, videoDimensions)
        };
    });

    if (sceneCrops.length === 0) {
        logger.warn('No scenes could be generated from detections.');
        return null;
    }

    // 5. Build the FFmpeg filter string with smooth transitions
    const TRANSITION_DURATION = 0.5; // seconds
    const initialCrop = sceneCrops[0].crop;

    let xExpr = `'if(lt(t,${sceneCrops[0].startTime}),${initialCrop.x},
`;
    let yExpr = `'if(lt(t,${sceneCrops[0].startTime}),${initialCrop.y},
`;

    for (let i = 0; i < sceneCrops.length; i++) {
        const current = sceneCrops[i];
        const next = sceneCrops[i + 1];

        if (next) {
            const transitionStart = current.endTime;
            const transitionEnd = current.endTime + TRANSITION_DURATION;
            // Linear interpolation for smooth transition
            const xPan = `(${current.crop.x}+(${next.crop.x}-${current.crop.x})*(t-${transitionStart})/${TRANSITION_DURATION})`;
            const yPan = `(${current.crop.y}+(${next.crop.y}-${current.crop.y})*(t-${transitionStart})/${TRANSITION_DURATION})`;

            xExpr += `if(between(t,${current.startTime},${transitionStart}),${current.crop.x}, if(between(t,${transitionStart},${transitionEnd}),${xPan},
`;
            yExpr += `if(between(t,${current.startTime},${transitionStart}),${current.crop.y}, if(between(t,${transitionStart},${transitionEnd}),${yPan},
`;
        } else {
            // Last scene, hold the crop
            xExpr += `${current.crop.x}`;
            yExpr += `${current.crop.y}`;
        }
    }
    
    xExpr += ')'.repeat(sceneCrops.length * 2 - 1) + `'`;
    yExpr += ')'.repeat(sceneCrops.length * 2 - 1) + `'`;

    // Use a fixed 9:16 aspect ratio for width and height
    const outputWidth = videoDimensions.height * (9/16);
    const filterString = `crop=w=${outputWidth}:h=${videoDimensions.height}:x=${xExpr}:y=${yExpr}`;
    
    logger.info('Generated Visual Director Filter String:', { length: filterString.length });
    return filterString;
}


// --- Express Routes ---
router.post('/generate', async (req, res) => {
    try {
        const { transcriptId, targetPlatform, detections, outputName, generatedClipUrl } = req.body;
        
        if (!transcriptId || !targetPlatform || !detections) {
            return res.status(400).json({ error: 'Required parameters are missing' });
        }
        
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript || !transcript.videoUrl) {
            return res.status(404).json({ error: 'Transcript or video not found' });
        }
        
        const targetRatio = ASPECT_RATIOS[targetPlatform];
        if (!targetRatio) return res.status(400).json({ error: 'Invalid target platform' });
        
        const videoUrlToUse = generatedClipUrl || transcript.videoUrl;
        const tempVideoPath = path.join(__dirname, '..', '..', generatedClipUrl ? videoUrlToUse.substring(1) : `uploads/${path.basename(videoUrlToUse)}`);
        
        const sanitizedOutputName = (outputName || `${transcript.originalFilename.replace(/\.[^.]+$/, '')}_${targetPlatform}_reframed`).replace(/[/\\:*?"<>|]/g, '_') + '.mp4';
        const outputPath = path.join('uploads/temp', sanitizedOutputName);
        
        const videoDimensions = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
                if (err) return reject(err);
                const s = metadata.streams.find(s => s.codec_type === 'video');
                resolve({ width: s.width, height: s.height });
            });
        });

        const directorCutFilter = generateVisualDirectorFilter(detections, videoDimensions);
        
        if (!directorCutFilter) {
            return res.status(500).json({ error: "Failed to generate reframing logic from face detections." });
        }

        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .videoFilters(directorCutFilter)
                .outputOptions(['-c:v libx264', '-crf 23', '-preset medium', '-c:a aac', '-b:a 128k'])
                .output(outputPath)
                .on('progress', (progress) => logger.info(`Processing: ${progress.percent}% done`))
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        
        const reframedDestPath = path.join('uploads', 'clips', 'reframed', sanitizedOutputName);
        fs.mkdirSync(path.dirname(reframedDestPath), { recursive: true });
        fs.renameSync(outputPath, reframedDestPath);
        const reframedUrl = `/uploads/clips/reframed/${sanitizedOutputName}`;
        
        res.json({
            success: true,
            reframedVideo: {
                filename: sanitizedOutputName,
                url: reframedUrl,
                platform: targetPlatform,
                platformName: targetRatio.name,
                aspectRatio: `${targetRatio.width}:${targetRatio.height}`
            }
        });
        
    } catch (error) {
        logger.logError(error, { context: 'reframe_generation' });
        res.status(500).json({ error: 'Failed to generate reframed video', details: error.message });
    }
});

// This is a simplified preview endpoint. A full implementation would need to calculate
// the crop for the specific timestamp requested.
router.post('/analyze', async (req, res) => {
    try {
        const { detections, targetPlatform, transcriptId, generatedClipUrl } = req.body;
        if (!transcriptId) return res.status(400).json({ error: 'Transcript ID is required' });
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) return res.status(404).json({ error: 'Transcript not found' });
        const videoUrlToUse = generatedClipUrl || transcript.videoUrl;
        if (!videoUrlToUse) return res.status(404).json({ error: 'Video not found' });
        const videoPath = path.join(__dirname, '..', '..', generatedClipUrl ? videoUrlToUse.substring(1) : `uploads/${path.basename(videoUrlToUse)}`);
        
        const videoDimensions = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) return reject(err);
                const s = metadata.streams.find(s => s.codec_type === 'video');
                resolve({ width: s.width, height: s.height });
            });
        });
        
        const targetRatio = ASPECT_RATIOS[targetPlatform];
        const parsedDetections = typeof detections === 'string' ? JSON.parse(detections) : detections;
        const cropParams = parsedDetections.length > 0 ? calculateCropForFace(parsedDetections[0], videoDimensions) : null;
        
        if (!cropParams) {
            return res.status(400).json({ error: 'Could not determine crop parameters from detections.' });
        }

        const previewPath = await generatePreviewFrame(videoPath, cropParams);
        const previewUrl = `/uploads/previews/${path.basename(previewPath)}`;
        fs.renameSync(previewPath, path.join('uploads', 'previews', path.basename(previewPath)));
        
        res.json({
            success: true,
            analysis: {
                cropParameters: cropParams,
                previewUrl
            }
        });
        
    } catch (error) {
        logger.logError(error, { context: 'reframe_analysis' });
        res.status(500).json({ error: 'Failed to analyze video', details: error.message });
    }
});


async function generatePreviewFrame(videoPath, cropParams, timestamp = 2) {
    return new Promise((resolve, reject) => {
        const previewPath = path.join('uploads/temp', `preview_${Date.now()}.jpg`);
        ffmpeg(videoPath)
            .seekInput(timestamp)
            .frames(1)
            .videoFilters([`crop=${cropParams.width}:${cropParams.height}:${cropParams.x}:${cropParams.y}`, 'scale=400:-1'])
            .output(previewPath)
            .on('end', () => resolve(previewPath))
            .on('error', reject)
            .run();
    });
}

module.exports = router;
