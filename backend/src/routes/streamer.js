const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');
const Transcript = require('../models/Transcript');
const logger = require('../utils/logger');
const axios = require('axios');

const router = express.Router();
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

/**
 * Process streamer + gameplay crop
 * POST /clips/streamer/streamer-gameplay
 */
router.post('/streamer-gameplay', async (req, res) => {
  let tempWebcamPath, tempGameplayPath, finalOutputPath, localSourceVideoPath; // For cleanup
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
    if (!transcript || !transcript.videoUrl) {
      return res.status(404).json({ error: 'Transcript or videoUrl not found' });
    }
    
    // Create temporary directories
    const tempDir = path.join(os.tmpdir(), 'vinci-clips-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    
    // --- Download remote video ---
    // This is now the only path for getting the source video
    const videoUrl = new URL(transcript.videoUrl);
    localSourceVideoPath = path.join(tempDir, `source_${timestamp}_${path.basename(videoUrl.pathname)}`);
    logger.info(`Downloading remote video from ${transcript.videoUrl} to ${localSourceVideoPath}`);
    const writer = fs.createWriteStream(localSourceVideoPath);
    const response = await axios({ url: transcript.videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
    logger.info('Download complete.');
    // ---

    // Create temporary file paths
    tempWebcamPath = path.join(tempDir, `webcam_${timestamp}.mp4`);
    tempGameplayPath = path.join(tempDir, `gameplay_${timestamp}.mp4`);
    finalOutputPath = path.join(tempDir, `final_${timestamp}.mp4`);
    const outputFilename = outputName || `streamer_gameplay_${timestamp}.mp4`;
    
    logger.info('Starting streamer gameplay processing', { 
      transcriptId,
      sourceVideoPath: localSourceVideoPath
    });
    
    // Get video duration
    const videoDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(localSourceVideoPath, (err, metadata) => {
        if (err) return reject(err);
        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
    
    logger.info('Video duration:', { videoDuration });
    
    // Step 1: Extract webcam area
    logger.info('Extracting webcam area', { webcamArea });
    await new Promise((resolve, reject) => {
      ffmpeg(localSourceVideoPath)
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
      ffmpeg(localSourceVideoPath)
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
            .input(localSourceVideoPath) // for audio
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
    
    // Upload the final clip to GCS
    const clipBlobName = `clips/streamer/${outputFilename}`;
    await bucket.upload(finalOutputPath, {
        destination: clipBlobName,
    });

    // Construct the public URL
    const processedVideoUrl = `https://storage.googleapis.com/${bucket.name}/${clipBlobName}`;
    
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
  } finally {
    // Cleanup temporary files
    if (localSourceVideoPath && fs.existsSync(localSourceVideoPath)) fs.unlinkSync(localSourceVideoPath);
    if (tempWebcamPath && fs.existsSync(tempWebcamPath)) fs.unlinkSync(tempWebcamPath);
    if (tempGameplayPath && fs.existsSync(tempGameplayPath)) fs.unlinkSync(tempGameplayPath);
    if (finalOutputPath && fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
  }
});

module.exports = router;
