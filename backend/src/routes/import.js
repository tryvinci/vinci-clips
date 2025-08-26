const express = require('express');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Transcript = require('../models/Transcript');
const { processVideo } = require('../utils/videoProcessor');

const router = express.Router();

// Ensure the imports directory exists
const importsDir = 'uploads/imports';
if (!fs.existsSync(importsDir)) {
    fs.mkdirSync(importsDir, { recursive: true });
}

// Platform detection and URL validation utilities
const detectPlatform = (url) => {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
        // Add other platforms here if needed
        return 'unknown';
    } catch {
        return 'unknown';
    }
};

const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// YouTube video extraction
const extractYouTubeVideo = async (url) => {
    const requestOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    };

    if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
    }
    const info = await ytdl.getInfo(url, { requestOptions });
    const videoDetails = info.videoDetails;
    return {
        title: videoDetails.title,
        duration: parseInt(videoDetails.lengthSeconds),
        videoId: videoDetails.videoId
    };
};

// YouTube-specific download using ytdl stream
const downloadYouTubeVideo = (url, outputPath) => {
    const requestOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    };

    return new Promise((resolve, reject) => {
        const stream = ytdl(url, {
            quality: 'highest',
            filter: format => format.hasAudio && format.hasVideo,
            requestOptions,
        });
        const writer = fs.createWriteStream(outputPath);
        stream.pipe(writer);
        stream.on('error', (error) => reject(new Error(`YouTube download failed: ${error.message}`)));
        writer.on('error', (error) => reject(new Error(`File write failed: ${error.message}`)));
        writer.on('finish', () => {
            console.log(`[Import] YouTube download completed: ${outputPath}`);
            resolve();
        });
    });
};

// Main URL import endpoint
router.post('/url', async (req, res) => {
    const { url } = req.body;
    const userId = req.auth.userId;

    if (!url || !validateUrl(url)) {
        return res.status(400).json({ error: 'A valid URL is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
    }

    const platform = detectPlatform(url);
    if (platform !== 'youtube') {
        return res.status(400).json({ error: 'Unsupported platform. Only YouTube is currently supported.' });
    }

    let transcript;
    try {
        const videoInfo = await extractYouTubeVideo(url);
        
        // Use the transcript's unique ID for all file operations to guarantee a safe filename
        const safeFilenameBase = new mongoose.Types.ObjectId().toString();
        const videoPath = path.join(importsDir, `${safeFilenameBase}.mp4`);
        const finalFilename = `${videoInfo.title.replace(/[^\w\s.-]/g, '_')}.mp4`; // For display

        transcript = new Transcript({
            _id: safeFilenameBase, // Use the same ID for the document
            userId: userId,
            originalFilename: finalFilename, // Store the user-friendly title
            status: 'uploading',
            importUrl: url,
            platform: platform,
            externalVideoId: videoInfo.videoId
        });
        await transcript.save();
        console.log(`[Import] Created transcript record ${transcript._id} for user ${userId}`);

        // Respond to client immediately
        res.status(202).json({
            message: 'Import request received, download and processing started.',
            transcriptId: transcript._id
        });

        await downloadYouTubeVideo(url, videoPath);

        // Start the full processing in the background using the shared processor
        // We pass the original (sanitized) title for GCS, but the processing uses the safe path
        processVideo(transcript._id, videoPath, finalFilename, userId, videoInfo.duration);

    } catch (error) {
        console.error(`[Import] Failed to import video from URL: ${url}. Error: ${error.message}`);
        if (transcript) {
            transcript.status = 'failed';
            await transcript.save();
        }
        // Note: We don't send a response here because we already sent a 202
    }
});

module.exports = router;