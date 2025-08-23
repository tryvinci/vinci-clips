const express = require('express');
const router = express.Router();
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const Transcript = require('../models/Transcript');
const { processVideo } = require('../utils/videoProcessor');

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
});

// Ensure the uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

router.post('/file', upload.single('video'), async (req, res) => {
    const userId = req.auth.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
    }

    const videoPath = req.file.path;
    const originalFilename = req.file.originalname;

    // Create initial transcript record
    let transcript = new Transcript({
        originalFilename: originalFilename,
        status: 'uploading',
        userId: userId
    });
    await transcript.save();
    
    console.log(`[Upload] Created transcript record ${transcript._id} for user ${userId}`);

    // Immediately respond to the client to acknowledge receipt
    res.status(202).json({ 
        message: 'Upload received, processing has started.',
        transcriptId: transcript._id 
    });

    // Asynchronously get video duration
    let videoDuration = 0;
    try {
        const durationCmd = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
        const stdout = await new Promise((resolve, reject) => {
            exec(durationCmd, (error, stdout) => {
                if (error) reject(error);
                else resolve(stdout);
            });
        });
        videoDuration = parseFloat(stdout.trim());
    } catch (durationError) {
        console.warn(`[Upload] Could not get video duration for ${transcript._id}: ${durationError}`);
    }

    // Start the full processing in the background. No `await` here.
    processVideo(transcript._id, videoPath, originalFilename, userId, videoDuration);
});

module.exports = router;