const express = require('express');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Transcript = require('../models/Transcript');
const { processVideo } = require('../utils/videoProcessor');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager'); // Import the client
const { Storage } = require('@google-cloud/storage'); // Import GCS

const router = express.Router();

// --- GCS Setup ---
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');
// --- END GCS Setup ---

// --- START: NEW CODE FOR COOKIE HANDLING ---

let youtubeCookieString = ''; // This will hold our formatted cookie string

/**
 * Parses the content of a cookies.txt file into an HTTP Cookie header string.
 * @param {string} cookiesTxtContent The raw text content from cookies.txt.
 * @returns {string} A formatted string like "key1=value1; key2=value2;".
 */
const parseCookiesTxt = (cookiesTxtContent) => {
    return cookiesTxtContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#')) // Ignore empty lines and comments
        .map(line => {
            const parts = line.split('\t');
            if (parts.length >= 7) {
                const name = parts[5];
                const value = parts[6];
                return `${name}=${value}`;
            }
            return null;
        })
        .filter(Boolean)
        .join('; ');
};

/**
 * Fetches the cookie data from Secret Manager and populates our cookie variable.
 * This should run once when the server starts.
 */
async function initializeCookies() {
    try {
        // IMPORTANT: Replace with your project ID and secret name
        const secretName = 'projects/382403086889/secrets/youtube-cookies/versions/latest';
        
        const client = new SecretManagerServiceClient();
        const [version] = await client.accessSecretVersion({ name: secretName });
        
        const cookiesTxtContent = version.payload.data.toString('utf8');
        youtubeCookieString = parseCookiesTxt(cookiesTxtContent);
        
        console.log('[Auth] Successfully initialized YouTube cookies.');
    } catch (error) {
        console.error('[Auth] FATAL: Could not initialize YouTube cookies from Secret Manager.', error);
        // In a real app, you might want to prevent the server from starting if cookies are essential
        // process.exit(1); 
    }
}



// Reusable function to get request options
const getRequestOptions = () => {
    if (!youtubeCookieString) {
        throw new Error('YouTube cookie string is not initialized.');
    }
    return {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36',
            'cookie': youtubeCookieString, // Use the parsed cookie string
        },
    };
};

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

// YouTube video extraction - MODIFIED
const extractYouTubeVideo = async (url) => {
    if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
    }
    const info = await ytdl.getInfo(url, { requestOptions: getRequestOptions() });
    const videoDetails = info.videoDetails;
    return {
        title: videoDetails.title,
        duration: parseInt(videoDetails.lengthSeconds),
        videoId: videoDetails.videoId
    };
};

// MODIFIED: Streams YouTube download directly to Google Cloud Storage
const downloadYouTubeVideoToGCS = (url, gcsPath) => {
    return new Promise((resolve, reject) => {
        console.log(`[Import] Starting GCS stream for ${gcsPath}`);
        const videoStream = ytdl(url, {
            quality: 'highest',
            filter: format => format.hasAudio && format.hasVideo,
            requestOptions: getRequestOptions(),
        });

        const gcsFile = bucket.file(gcsPath);
        const gcsWriteStream = gcsFile.createWriteStream({
            resumable: false, // Good for smaller files / single streams
            contentType: 'video/mp4',
        });

        videoStream.pipe(gcsWriteStream)
            .on('finish', () => {
                console.log(`[Import] GCS stream finished for ${gcsPath}`);
                resolve();
            })
            .on('error', (error) => {
                console.error(`[Import] GCS write stream failed for ${gcsPath}:`, error);
                reject(new Error(`GCS write stream failed: ${error.message}`));
            });

        videoStream.on('error', (error) => {
            console.error(`[Import] YouTube download stream failed for ${gcsPath}:`, error);
            reject(new Error(`YouTube download failed: ${error.message}`));
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
        
        const safeFilenameBase = new mongoose.Types.ObjectId().toString();
        const finalFilename = `${videoInfo.title.replace(/[^\w\s.-]/g, '_')}.mp4`;
        
        // Define the path for the file in Google Cloud Storage
        const gcsVideoPath = `users/${userId}/videos/${finalFilename}`;

        transcript = new Transcript({
            _id: safeFilenameBase,
            userId: userId,
            originalFilename: finalFilename,
            status: 'uploading',
            importUrl: url,
            platform: platform,
            externalVideoId: videoInfo.videoId,
            videoCloudPath: gcsVideoPath // Store the GCS path early
        });
        await transcript.save();
        console.log(`[Import] Created transcript record ${transcript._id} for user ${userId}`);

        // Respond to client immediately
        res.status(202).json({
            message: 'Import request received, streaming to cloud and processing started.',
            transcriptId: transcript._id
        });

        // Await the direct stream to GCS
        await downloadYouTubeVideoToGCS(url, gcsVideoPath);

        // Start the full processing in the background, now passing the GCS path
        processVideo(transcript._id, gcsVideoPath, finalFilename, userId, videoInfo.duration);

    } catch (error) {
        console.error(`[Import] Failed to import video from URL: ${url}. Error: ${error.message}`);
        if (transcript) {
            transcript.status = 'failed';
            await transcript.save();
        }
        // Note: We don't send a response here because we already sent a 202
    }
});

// --- IMPORTANT: Call the initialization function when your module is loaded ---
initializeCookies();

module.exports = router;