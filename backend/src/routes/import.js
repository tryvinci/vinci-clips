const express = require('express');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Transcript = require('../models/Transcript');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

// Ensure the imports directory exists
const importsDir = 'uploads/imports';
if (!fs.existsSync(importsDir)) {
    fs.mkdirSync(importsDir, { recursive: true });
}

// Platform detection utility
const detectPlatform = (url) => {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return 'youtube';
    } else if (hostname.includes('vimeo.com')) {
        return 'vimeo';
    } else if (hostname.includes('instagram.com')) {
        return 'instagram';
    } else if (hostname.includes('linkedin.com')) {
        return 'linkedin';
    } else if (hostname.includes('tiktok.com')) {
        return 'tiktok';
    } else if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
        return 'facebook';
    }
    
    return 'unknown';
};

// URL validation utility
const validateUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
};

// YouTube video extraction
const extractYouTubeVideo = async (url) => {
    try {
        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            throw new Error('Invalid YouTube URL');
        }

        // Get video info
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;

        // Get the best quality video format
        const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
        
        return {
            title: videoDetails.title,
            description: videoDetails.description,
            duration: parseInt(videoDetails.lengthSeconds),
            thumbnail: videoDetails.thumbnails?.[0]?.url,
            platform: 'youtube',
            originalUrl: url,
            downloadUrl: format.url,
            videoId: videoDetails.videoId
        };
    } catch (error) {
        throw new Error(`YouTube extraction failed: ${error.message}`);
    }
};

// Vimeo video extraction
const extractVimeoVideo = async (url) => {
    try {
        // Extract video ID from Vimeo URL
        const vimeoIdMatch = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
        if (!vimeoIdMatch) {
            throw new Error('Invalid Vimeo URL');
        }

        const videoId = vimeoIdMatch[1];
        
        // Use Vimeo oEmbed API to get video info
        const response = await axios.get(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
        const videoData = response.data;

        return {
            title: videoData.title,
            description: videoData.description || '',
            duration: videoData.duration || 0,
            thumbnail: videoData.thumbnail_url,
            platform: 'vimeo',
            originalUrl: url,
            videoId: videoId,
            // Note: Vimeo requires authentication for direct video download
            // This is a placeholder - in production, you'd need proper API access
            downloadUrl: null
        };
    } catch (error) {
        throw new Error(`Vimeo extraction failed: ${error.message}`);
    }
};

// Generic video download utility
const downloadVideo = async (downloadUrl, outputPath) => {
    try {
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 300000 // 5 minutes timeout
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        throw new Error(`Video download failed: ${error.message}`);
    }
};

// Main URL import endpoint
router.post('/url', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (!validateUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const platform = detectPlatform(url);
    
    if (platform === 'unknown') {
        return res.status(400).json({ error: 'Unsupported platform' });
    }

    try {
        let videoInfo;
        
        // Extract video information based on platform
        switch (platform) {
            case 'youtube':
                videoInfo = await extractYouTubeVideo(url);
                break;
            case 'vimeo':
                videoInfo = await extractVimeoVideo(url);
                break;
            default:
                return res.status(400).json({ 
                    error: `Platform ${platform} not yet implemented` 
                });
        }

        // Create initial transcript record
        const transcript = new Transcript({
            originalFilename: `${videoInfo.title}.mp4`,
            transcript: [],
            status: 'uploading',
            importUrl: url,
            platform: platform,
            externalVideoId: videoInfo.videoId
        });
        
        await transcript.save();
        console.log(`Created transcript record ${transcript._id} for ${platform} import`);

        // For YouTube, we can download directly
        if (platform === 'youtube' && videoInfo.downloadUrl) {
            // Download video in background
            const videoPath = path.join(importsDir, `${transcript._id}.mp4`);
            
            try {
                // Download the video
                await downloadVideo(videoInfo.downloadUrl, videoPath);
                
                // Update status to converting
                transcript.status = 'converting';
                await transcript.save();
                
                // Process similar to regular upload
                const mp3Path = `${videoPath}.mp3`;
                const thumbnailPath = `${videoPath}_thumbnail.jpg`;
                
                // Convert to MP3
                const ffmpegCmd = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${mp3Path}"`;
                
                await new Promise((resolve, reject) => {
                    exec(ffmpegCmd, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                
                // Generate thumbnail
                const thumbnailCmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
                
                try {
                    await new Promise((resolve, reject) => {
                        exec(thumbnailCmd, (error) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                } catch (thumbnailError) {
                    console.warn('Thumbnail generation failed:', thumbnailError);
                }
                
                // Upload to cloud storage
                const videoBlobPath = `videos/${transcript.originalFilename}`;
                const mp3BlobPath = `audio/${transcript.originalFilename.replace(/\.mp4$/, '.mp3')}`;
                const thumbnailBlobPath = `thumbnails/${transcript.originalFilename.replace(/\.mp4$/, '_thumbnail.jpg')}`;
                
                const uploadPromises = [
                    bucket.upload(videoPath, { destination: videoBlobPath }),
                    bucket.upload(mp3Path, { destination: mp3BlobPath })
                ];
                
                if (fs.existsSync(thumbnailPath)) {
                    uploadPromises.push(bucket.upload(thumbnailPath, { destination: thumbnailBlobPath }));
                }
                
                await Promise.all(uploadPromises);
                
                // Get signed URLs
                const [videoUrl] = await bucket.file(videoBlobPath).getSignedUrl({ action: 'read', expires: '03-09-2491' });
                const [mp3Url] = await bucket.file(mp3BlobPath).getSignedUrl({ action: 'read', expires: '03-09-2491' });
                
                let thumbnailUrl = null;
                if (fs.existsSync(thumbnailPath)) {
                    const [thumbUrl] = await bucket.file(thumbnailBlobPath).getSignedUrl({ action: 'read', expires: '03-09-2491' });
                    thumbnailUrl = thumbUrl;
                }
                
                // Update transcript with URLs and mark as ready for transcription
                transcript.videoUrl = videoUrl;
                transcript.videoCloudPath = videoBlobPath;
                transcript.mp3Url = mp3Url;
                transcript.thumbnailUrl = thumbnailUrl;
                transcript.duration = videoInfo.duration;
                transcript.status = 'transcribing';
                await transcript.save();
                
                // Cleanup local files
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                if (fs.existsSync(thumbnailPath)) {
                    fs.unlink(thumbnailPath, () => {});
                }
                
                // Continue with transcription (similar to upload.js)
                // ... (transcription logic would go here)
                
                res.status(200).json({
                    message: 'Video imported successfully',
                    transcript: transcript,
                    videoInfo: videoInfo
                });
                
            } catch (downloadError) {
                console.error('Download error:', downloadError);
                transcript.status = 'failed';
                await transcript.save();
                return res.status(500).json({ error: 'Failed to download video' });
            }
        } else {
            // For platforms that don't support direct download, return info only
            res.status(200).json({
                message: 'Video information extracted successfully',
                transcript: transcript,
                videoInfo: videoInfo,
                note: 'Direct download not supported for this platform'
            });
        }
        
    } catch (error) {
        console.error('URL import error:', error);
        res.status(500).json({ 
            error: 'Failed to import video',
            details: error.message 
        });
    }
});

module.exports = router;