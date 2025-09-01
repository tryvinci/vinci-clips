const express = require('express');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Transcript = require('../models/Transcript');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const router = express.Router();

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

        // Get the best quality video format that includes audio
        // Try to get a format with both audio and video, fall back if needed
        let format;
        try {
            format = ytdl.chooseFormat(info.formats, { 
                quality: 'highestvideo',
                filter: 'audioandvideo' 
            });
        } catch (error) {
            console.log('No audioandvideo format found, trying highest quality with audio...');
            format = ytdl.chooseFormat(info.formats, { 
                quality: 'highest',
                filter: format => format.hasAudio && format.hasVideo
            });
        }
        
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

// YouTube-specific download using ytdl stream
const downloadYouTubeVideo = async (url, outputPath) => {
    return new Promise((resolve, reject) => {
        try {
            // Use ytdl to download with audio+video format preference
            const stream = ytdl(url, {
                quality: 'highest',
                filter: format => format.hasAudio && format.hasVideo
            });

            const writer = fs.createWriteStream(outputPath);
            stream.pipe(writer);

            stream.on('error', (error) => {
                console.error('ytdl stream error:', error.message);
                reject(new Error(`YouTube download failed: ${error.message}`));
            });

            writer.on('error', (error) => {
                console.error('File write error:', error.message);
                reject(new Error(`File write failed: ${error.message}`));
            });

            writer.on('finish', () => {
                console.log('YouTube download completed:', outputPath);
                resolve();
            });

        } catch (error) {
            reject(new Error(`YouTube download setup failed: ${error.message}`));
        }
    });
};

// Generic video download utility (for other platforms)
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
        let transcript = await Transcript.create({
            originalFilename: `${videoInfo.title}.mp4`,
            transcript: [],
            status: 'uploading',
            importUrl: url,
            platform: platform,
            externalVideoId: videoInfo.videoId
        });
        
        console.log(`Created transcript record ${transcript._id} for ${platform} import`);

        // For YouTube, we can download directly
        if (platform === 'youtube') {
            // Download video using ytdl stream to ensure audio+video
            const videoPath = path.join(importsDir, `${transcript._id}.mp4`);
            
            try {
                // Download the video using ytdl stream instead of URL
                await downloadYouTubeVideo(url, videoPath);
                
                // Update status to converting
                await Transcript.findByIdAndUpdate(transcript._id, { status: 'converting' });
                
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
                
                const videoFileName = transcript.originalFilename;
                const mp3FileName = videoFileName.replace(/\.[^/.]+$/, "") + ".mp3";
                const thumbnailFileName = videoFileName.replace(/\.[^/.]+$/, "") + "_thumbnail.jpg";

                const videoDestPath = path.join('uploads', videoFileName);
                const mp3DestPath = path.join('uploads', mp3FileName);
                const thumbnailDestPath = path.join('uploads', thumbnailFileName);

                // Ensure storage directories exist
                fs.mkdirSync(path.dirname(videoDestPath), { recursive: true });

                fs.renameSync(videoPath, videoDestPath);
                fs.renameSync(mp3Path, mp3DestPath);
                if (fs.existsSync(thumbnailPath)) {
                    fs.renameSync(thumbnailPath, thumbnailDestPath);
                }

                const videoUrl = `/uploads/${videoFileName}`;
                const mp3Url = `/uploads/${mp3FileName}`;
                const thumbnailUrl = fs.existsSync(thumbnailDestPath) ? `/uploads/${thumbnailFileName}` : null;
                
                // Update transcript with URLs and mark as ready for transcription
                await Transcript.findByIdAndUpdate(transcript._id, {
                    videoUrl: videoUrl,
                    mp3Url: mp3Url,
                    thumbnailUrl: thumbnailUrl,
                    duration: videoInfo.duration,
                    status: 'transcribing'
                });
                
                // Start transcription
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

                const uploadResult = await fileManager.uploadFile(mp3DestPath, {
                    mimeType: 'audio/mpeg',
                    displayName: mp3FileName
                });

                const model = genAI.getGenerativeModel({
                    model: process.env.LLM_MODEL || 'gemini-1.5-flash',
                });
                
                const audioPart = { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } };

                const prompt = "Transcribe the provided audio with word-level timestamps and identify the speaker for each word. Format the output as a JSON array of objects, where each object represents a single word with precise millisecond timing. Each object should have 'start' (in format MM:SS:mmm), 'end' (in format MM:SS:mmm), 'text' (single word), and 'speaker' fields. For example: [{'start': '00:00:000', 'end': '00:00:450', 'text': 'Hello', 'speaker': 'Speaker 1'}, {'start': '00:00:450', 'end': '00:00:890', 'text': 'world', 'speaker': 'Speaker 1'}]";

                const result = await model.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: prompt },
                            audioPart,
                        ],
                    }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    start: { type: 'STRING' },
                                    end: { type: 'STRING' },
                                    text: { type: 'STRING' },
                                    speaker: { type: 'STRING' },
                                },
                                required: ['start', 'end', 'text', 'speaker'],
                                propertyOrdering: ['start', 'end', 'text', 'speaker'],
                            },
                        },
                    },
                });

                const response = await result.response;
                const transcriptContent = JSON.parse(response.text());

                // Update transcript with transcription and mark as completed
                const finalTranscript = await Transcript.findByIdAndUpdate(transcript._id, {
                    transcript: transcriptContent,
                    status: 'completed'
                }, { new: true });

                console.log(`Transcript ${transcript._id} for imported video completed successfully`);
                
                res.status(200).json({
                    message: 'Video imported and transcribed successfully',
                    transcript: finalTranscript,
                    videoInfo: videoInfo
                });
                
            } catch (downloadError) {
                console.error('Download or transcription error:', downloadError);
                await Transcript.findByIdAndUpdate(transcript._id, { status: 'failed' });
                return res.status(500).json({ error: 'Failed to download or transcribe video' });
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