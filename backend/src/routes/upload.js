const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Transcript = require('../models/Transcript');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

// The application will now use Application Default Credentials (ADC) in all environments.
// For local development, authenticate by running `gcloud auth application-default login`.
// In Cloud Run, the attached service account's identity is used automatically.

const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
});

// Ensure the uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Handler for establishing the SSE connection
router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    console.log('SSE connection established');

    // Keep the connection open but don't do anything else
    // The client will send the upload request to the POST endpoint
    
    req.on('close', () => {
        console.log('SSE connection closed');
        res.end();
    });
});


router.post('/file', upload.single('video'), async (req, res) => {
    const userId = req.auth.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
    }

    const videoPath = req.file.path;
    const mp3Path = `${videoPath}.mp3`;
    const thumbnailPath = `${videoPath}_thumbnail.jpg`;
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Create initial transcript record with uploading status
    let transcript = new Transcript({
        originalFilename: req.file.originalname,
        transcript: [],
        status: 'uploading',
        userId: userId
    });
    await transcript.save();
    
    console.log(`Created transcript record ${transcript._id} with status: uploading`);

    try {
        // Get video duration first
        const durationCmd = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
        let videoDuration = null;
        
        try {
            videoDuration = await new Promise((resolve, reject) => {
                exec(durationCmd, (error, stdout) => {
                    if (error) reject(error);
                    else resolve(parseFloat(stdout.trim()));
                });
            });
        } catch (durationError) {
            console.warn(`Could not get video duration: ${durationError}`);
        }

        // Update status to converting
        transcript.status = 'converting';
        await transcript.save();
        console.log(`Updated transcript ${transcript._id} status: converting`);

        // Generate thumbnail (first frame) and convert to MP3
        const thumbnailCmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
        const ffmpegCmd = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${mp3Path}"`;
        
        // Generate thumbnail first
        try {
            await new Promise((resolve, reject) => {
                exec(thumbnailCmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            console.log('Thumbnail generated successfully');
        } catch (thumbnailError) {
            console.warn(`Thumbnail generation failed: ${thumbnailError}`);
        }

        exec(ffmpegCmd, async (error) => {
            if (error) {
                console.error(`ffmpeg error: ${error}`);
                // Update status to failed
                transcript.status = 'failed';
                await transcript.save();
                // Clean up local files even if ffmpeg fails
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                fs.unlink(thumbnailPath, () => {});
                return res.status(500).json({ error: 'Failed to convert video to MP3.' });
            }

            try {
                const videoBlobPath = `videos/${req.file.originalname}`;
                const videoBlob = bucket.file(videoBlobPath);
                const mp3BlobName = req.file.originalname.replace(/\.mp4$/, ".mp3");
                const mp3Blob = bucket.file(`audio/${mp3BlobName}`);
                const thumbnailBlobName = req.file.originalname.replace(/\.\w+$/, "_thumbnail.jpg");
                const thumbnailBlob = bucket.file(`thumbnails/${thumbnailBlobName}`);

                // Upload video, audio, and thumbnail in parallel
                const uploadPromises = [
                    bucket.upload(videoPath, { destination: videoBlob.name }),
                    bucket.upload(mp3Path, { destination: mp3Blob.name })
                ];
                
                // Only upload thumbnail if it exists
                if (fs.existsSync(thumbnailPath)) {
                    uploadPromises.push(bucket.upload(thumbnailPath, { destination: thumbnailBlob.name }));
                }
                
                await Promise.all(uploadPromises);

                // Construct public URLs
                const videoUrl = `https://storage.googleapis.com/${bucket.name}/${videoBlob.name}`;
                const mp3Url = `https://storage.googleapis.com/${bucket.name}/${mp3Blob.name}`;
                let thumbnailUrl = null;
                if (fs.existsSync(thumbnailPath)) {
                    thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailBlob.name}`;
                }

                // Update status to transcribing
                transcript.status = 'transcribing';
                await transcript.save();
                console.log(`Updated transcript ${transcript._id} status: transcribing`);
                
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

                // Upload the local MP3 file directly to Gemini File API
                const uploadResult = await fileManager.uploadFile(mp3Path, {
                    mimeType: 'audio/mpeg',
                    displayName: mp3BlobName
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
                                required: ['start', 'end', 'text', 'speaker']
                                
                            },
                        },
                    },
                });

                const response = await result.response;
                const transcriptContent = JSON.parse(response.text());
                
                // Update existing transcript with all data and mark as completed
                transcript.transcript = transcriptContent;
                transcript.videoUrl = videoUrl;
                transcript.videoCloudPath = videoBlobPath;
                transcript.mp3Url = mp3Url;
                transcript.duration = videoDuration;
                transcript.thumbnailUrl = thumbnailUrl;
                transcript.status = 'completed';
                await transcript.save();
                console.log(`Transcript ${transcript._id} completed successfully`);

                // Cleanup local files
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                fs.unlink(thumbnailPath, () => {});

                res.status(200).json({ status: 'Transcription complete.', transcript: transcript });

            } catch (apiError) {
                console.error(`Gemini API or upload error: ${apiError}`);
                // Cleanup local files even if API fails
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                res.status(500).json({ error: 'Failed to transcribe audio or upload files.' });
            }
        });
    } catch (err) {
        console.error(`Server error: ${err}`);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});

module.exports = router; 