
const express = require('express');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const Transcript = require('../models/Transcript');
const { processVideo } = require('../utils/videoProcessor');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const router = express.Router();

// --- START: yt-dlp COOKIE HANDLING ---

let cookieFilePath = '';
let ytDlp;

async function initializeYTDlp() {
    try {
        ytDlp = new YTDlpWrap(process.env.YT_DLP_PATH);
        const version = await ytDlp.execPromise(['--version']);
        console.log('[Auth] yt-dlp binary found:', version.trim());

        console.log('[Auth] Initializing YouTube cookies for yt-dlp...');
        const secretName = 'projects/382403086889/secrets/youtube-cookies/versions/latest';
        
        const client = new SecretManagerServiceClient();
        const [secretVersion] = await client.accessSecretVersion({ name: secretName });
        
        const cookiesTxtContent = secretVersion.payload.data.toString('utf8');
        if (!cookiesTxtContent) throw new Error('Fetched cookie content is empty.');

        const tempDir = path.join(os.tmpdir(), 'vinci-clips-cookies');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        cookieFilePath = path.join(tempDir, 'youtube-cookies.txt');
        fs.writeFileSync(cookieFilePath, cookiesTxtContent);
        
        console.log(`[Auth] Successfully initialized YouTube cookies at: ${cookieFilePath}`);
    } catch (error) {
        console.error('[Auth] FATAL: Could not initialize yt-dlp or cookies.', error);
        process.exit(1); 
    }
}

// --- END: yt-dlp COOKIE HANDLING ---

// Ensure the temporary directory for imports exists
const importsDir = path.join(__dirname, '..', '..', 'uploads', 'imports');
if (!fs.existsSync(importsDir)) {
    fs.mkdirSync(importsDir, { recursive: true });
}

const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch { return false; }
};

const extractYouTubeVideo = async (url) => {
    try {
        console.log(`[Import] Extracting video info for URL: ${url}`);
        const videoInfo = await ytDlp.getVideoInfo(url, { cookies: cookieFilePath });
        return {
            title: videoInfo.title,
            duration: videoInfo.duration,
            videoId: videoInfo.id,
        };
    } catch (error) {
        console.error(`[Import] Failed to extract video info for ${url}:`, error);
        throw new Error(`yt-dlp failed to get info: ${error.message}`);
    }
};

// Downloads YouTube video to a local file path
const downloadYouTubeVideoToLocal = (url, outputPath) => {
    return new Promise((resolve, reject) => {
        console.log(`[Import] Starting local download to ${outputPath}`);
        const ytDlpEventEmitter = ytDlp.exec([
            url,
            '--cookies', cookieFilePath,
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-o', outputPath,
        ]);

        ytDlpEventEmitter.on('close', () => {
            console.log(`[Import] Local download finished: ${outputPath}`);
            resolve();
        });

        ytDlpEventEmitter.on('error', (error) => {
            console.error(`[Import] yt-dlp download error for ${outputPath}:`, error);
            reject(error);
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

    let transcript;
    try {
        const videoInfo = await extractYouTubeVideo(url);
        
        const safeFilenameBase = new mongoose.Types.ObjectId().toString();
        const localVideoPath = path.join(importsDir, `${safeFilenameBase}.mp4`);
        const finalFilename = `${videoInfo.title.replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_')}.mp4`;

        transcript = new Transcript({
            _id: safeFilenameBase,
            userId: userId,
            originalFilename: finalFilename,
            status: 'uploading',
            importUrl: url,
            platform: 'youtube',
            externalVideoId: videoInfo.videoId,
        });
        await transcript.save();
        console.log(`[Import] Created transcript record ${transcript._id}`);

        res.status(202).json({
            message: 'Import request received, download and processing started.',
            transcriptId: transcript._id
        });

        await downloadYouTubeVideoToLocal(url, localVideoPath);

        // Call the processor with the LOCAL path
        processVideo(transcript._id, localVideoPath, finalFilename, userId, videoInfo.duration);

    } catch (error) {
        console.error(`[Import] Failed to import video from URL: ${url}. Error: ${error.message}`);
        if (transcript) {
            transcript.status = 'failed';
            await transcript.save();
        }
    }
});

initializeYTDlp();

module.exports = router;