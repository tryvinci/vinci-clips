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
const upload = multer({ dest: 'uploads/' });

// Ensure the uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

router.post('/', upload.single('video'), async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const videoPath = req.file.path;
    const mp3Path = `${videoPath}.mp3`;
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const sendEvent = (data) => res.write(`data: ${JSON.stringify({ jobId, ...data })}\n\n`);

    try {
        sendEvent({ status: 'Converting to MP3...', progress: 10 });
        const ffmpegCmd = `ffmpeg -i ${videoPath} -vn -acodec libmp3lame -q:a 2 ${mp3Path}`;
        
        exec(ffmpegCmd, async (error) => {
            if (error) {
                console.error(`ffmpeg error: ${error}`);
                sendEvent({ error: 'Failed to convert video to MP3.', progress: 100 });
                // Clean up local files even if ffmpeg fails
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                return res.end();
            }

            try {
                sendEvent({ status: 'Uploading files to cloud...', progress: 30 });
                const videoBlob = bucket.file(`videos/${req.file.originalname}`);
                const mp3Blob = bucket.file(`audio/${req.file.originalname}.mp3`);

                await bucket.upload(videoPath, { destination: videoBlob.name });
                await bucket.upload(mp3Path, { destination: mp3Blob.name });

                const [videoUrl] = await videoBlob.getSignedUrl({ action: 'read', expires: '03-09-2491' });
                const [mp3Url] = await mp3Blob.getSignedUrl({ action: 'read', expires: '03-09-2491' });

                console.log(`Job ID: ${jobId} - Video URL: ${videoUrl}`);
                console.log(`Job ID: ${jobId} - MP3 URL: ${mp3Url}`);

                sendEvent({ status: 'Transcribing...', progress: 70, videoUrl, mp3Url });
                
                // Gemini API transcription
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: process.env.LLM_MODEL || 'gemini-1.5-flash',
                });

                const audioData = fs.readFileSync(mp3Path);
                const audioPart = {
                    inlineData: {
                        data: audioData.toString('base64'),
                        mimeType: 'audio/mpeg',
                    },
                };

                const prompt = "Transcribe the provided audio into segments with start and end times. Format the output as a JSON array of objects, where each object has 'start', 'end', and 'text' fields. For example: [{'start': '00:00', 'end': '00:05', 'text': 'Hello world.'}]";

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
                                },
                                required: ['start', 'end', 'text'],
                                propertyOrdering: ['start', 'end', 'text'],
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
                console.log(`Job ID: ${jobId} - Transcript saved to DB: ${newTranscript._id}`);
                sendEvent({ status: 'Transcription complete.', progress: 100, transcript: newTranscript });

                // Cleanup local files
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                res.end();

            } catch (apiError) {
                console.error(`Job ID: ${jobId} - Gemini API or upload error: ${apiError}`);
                sendEvent({ error: 'Failed to transcribe audio or upload files.', progress: 100 });
                // Cleanup local files even if API fails
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                res.end();
            }
        });
    } catch (err) {
        console.error(`Server error: ${err}`);
        sendEvent({ error: 'An unexpected server error occurred.', progress: 100 });
        res.end();
    }
});

module.exports = router; 