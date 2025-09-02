const express = require('express');
const router = express.Router();
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Transcript = require('../models/Transcript');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

// The application will now use Application Default Credentials (ADC) in all environments.
// For local development, authenticate by running `gcloud auth application-default login`.
// In Cloud Run, the attached service account's identity is used automatically.

const upload = multer({ 
    dest: 'uploads/temp/',
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
});

// Ensure the temp directory exists
const tempDir = 'uploads/temp';
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}



router.post('/file', upload.single('video'), async (req, res) => {
    const videoPath = req.file.path.trim();
    const mp3Path = `${videoPath}.mp3`;
    const thumbnailPath = `${videoPath}_thumbnail.jpg`;
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Create initial transcript record with uploading status
    let transcript = await Transcript.create({
        originalFilename: req.file.originalname,
        transcript: [],
        status: 'uploading'
    });
    
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
        transcript = await Transcript.findByIdAndUpdate(transcript._id, transcript, { new: true });
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
                await Transcript.findByIdAndUpdate(transcript._id, transcript);
                // Clean up local files even if ffmpeg fails
                fs.unlink(videoPath, () => {});
                fs.unlink(mp3Path, () => {});
                fs.unlink(thumbnailPath, () => {});
                return res.status(500).json({ error: 'Failed to convert video to MP3.' });
            }

            const videoFileName = req.file.originalname;
            const mp3FileName = videoFileName.replace(/\.[^/.]+$/, "") + ".mp3";
            const thumbnailFileName = videoFileName.replace(/\.[^/.]+$/, "") + "_thumbnail.jpg";

            const videoDestPath = path.join(__dirname, '..', '..', 'uploads', videoFileName);
            const mp3DestPath = path.join(__dirname, '..', '..', 'uploads', mp3FileName);
            const thumbnailDestPath = path.join(__dirname, '..', '..', 'uploads', thumbnailFileName);
            
            try {
                fs.renameSync(videoPath, videoDestPath);
                fs.renameSync(mp3Path, mp3DestPath);
                if (fs.existsSync(thumbnailPath)) {
                    fs.renameSync(thumbnailPath, thumbnailDestPath);
                }

                const videoUrl = `/uploads/${videoFileName}`;
                const mp3Url = `/uploads/${mp3FileName}`;
                const thumbnailUrl = fs.existsSync(thumbnailDestPath) ? `/uploads/${thumbnailFileName}` : null;

                // Update status to transcribing
                transcript.status = 'transcribing';
                transcript = await Transcript.findByIdAndUpdate(transcript._id, transcript, { new: true });
                console.log(`Updated transcript ${transcript._id} status: transcribing`);
                
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

                // Upload the local MP3 file directly to Gemini File API
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
                
                // Update existing transcript with all data and mark as completed
                transcript.transcript = transcriptContent;
                transcript.videoUrl = videoUrl;
                transcript.mp3Url = mp3Url;
                transcript.duration = videoDuration;
                transcript.thumbnailUrl = thumbnailUrl;
                transcript.status = 'completed';
                const finalTranscript = await Transcript.findByIdAndUpdate(transcript._id, transcript, { new: true });
                console.log(`Transcript ${transcript._id} completed successfully`);

                res.status(200).json({ status: 'Transcription complete.', transcript: finalTranscript });

            } catch (apiError) {
                console.error(`Gemini API or upload error: ${apiError}`);
                res.status(500).json({ error: 'Failed to transcribe audio or upload files.' });
            }
        });
    } catch (err) {
        console.error(`Server error: ${err}`);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});

module.exports = router;