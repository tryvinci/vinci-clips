const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Transcript = require('../models/Transcript');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part } = require('@google/generative-ai');

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
    // We are not using SSE here anymore for the response, 
    // but we can send progress back through a different channel if needed in the future.
    // For now, return the final result.

    const videoPath = req.file.path;
    const mp3Path = `${videoPath}.mp3`;
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
        const ffmpegCmd = `ffmpeg -i ${videoPath} -vn -acodec libmp3lame -q:a 2 ${mp3Path}`;
        
        exec(ffmpegCmd, async (error) => {
            if (error) {
                console.error(`ffmpeg error: ${error}`);
                // Clean up local files even if ffmpeg fails
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                return res.status(500).json({ error: 'Failed to convert video to MP3.' });
            }

            try {
                const videoBlob = bucket.file(`videos/${req.file.originalname}`);
                const mp3Blob = bucket.file(`audio/${req.file.originalname}.mp3`);

                // Upload both files in parallel
                await Promise.all([
                    bucket.upload(videoPath, { destination: videoBlob.name }),
                    bucket.upload(mp3Path, { destination: mp3Blob.name })
                ]);

                const [videoUrl] = await videoBlob.getSignedUrl({ action: 'read', expires: '03-09-2491' });
                const [mp3Url] = await mp3Blob.getSignedUrl({ action: 'read', expires: '03-09-2491' });
                
                // Gemini API transcription using GCS URI
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: process.env.LLM_MODEL || 'gemini-1.5-flash',
                });
                
                const audioUri = `gs://${bucket.name}/${mp3Blob.name}`;
                const audioPart = {
                    fileData: {
                        mimeType: 'audio/mpeg',
                        fileUri: audioUri,
                    },
                };

                const prompt = "Transcribe the provided audio into segments with start and end times, and identify the speaker for each segment. Format the output as a JSON array of objects, where each object has 'start', 'end', 'text', and 'speaker' fields. For example: [{'start': '00:00', 'end': '00:05', 'text': 'Hello world.', 'speaker': 'Speaker 1'}]";

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
                
                const newTranscript = new Transcript({
                    originalFilename: req.file.originalname,
                    transcript: transcriptContent,
                    videoUrl,
                    mp3Url,
                });
                await newTranscript.save();
                console.log(`Transcript saved to DB: ${newTranscript._id}`);

                // Cleanup local files
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});

                res.status(200).json({ status: 'Transcription complete.', transcript: newTranscript });

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