const express = require('express');
const Transcript = require('../models/Transcript');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

// Retry transcription for a stuck transcript
router.post('/retry/:transcriptId', async (req, res) => {
    const { transcriptId } = req.params;

    try {
        // Validate transcript ID format
        if (!transcriptId || !transcriptId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid transcript ID format.' });
        }

        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found.' });
        }

        // Check if transcript is in a state that can be retried
        if (!['transcribing', 'failed'].includes(transcript.status)) {
            return res.status(400).json({ 
                error: `Cannot retry transcript with status: ${transcript.status}` 
            });
        }

        if (!transcript.mp3Url) {
            return res.status(400).json({ 
                error: 'No MP3 URL found. Video processing may have failed.' 
            });
        }

        logger.logVideoProcessing(transcriptId, 'retrying', 'Starting transcription retry');

        // Update status to transcribing
        transcript.status = 'transcribing';
        await transcript.save();

        // Download MP3 from cloud storage to temp location
        const tempMp3Path = path.join('uploads', `retry_${transcriptId}.mp3`);
        const mp3CloudPath = transcript.mp3Url.split('/').pop().split('?')[0]; // Extract filename
        const mp3BlobPath = `audio/${transcript.originalFilename.replace(/\.mp4$/, '.mp3')}`;
        
        console.log(`Downloading MP3 from: ${mp3BlobPath}`);
        
        try {
            const mp3File = bucket.file(mp3BlobPath);
            await mp3File.download({ destination: tempMp3Path });
        } catch (downloadError) {
            console.error('Failed to download MP3:', downloadError);
            transcript.status = 'failed';
            await transcript.save();
            return res.status(500).json({ error: 'Failed to download MP3 for transcription' });
        }

        // Initialize Gemini API
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

        // Upload the MP3 file to Gemini File API
        console.log('Uploading MP3 to Gemini API...');
        const uploadResult = await fileManager.uploadFile(tempMp3Path, {
            mimeType: 'audio/mpeg',
            displayName: transcript.originalFilename.replace(/\.mp4$/, '.mp3')
        });

        const model = genAI.getGenerativeModel({
            model: process.env.LLM_MODEL || 'gemini-1.5-flash',
        });
        
        const audioPart = { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } };

        const prompt = "Transcribe the provided audio into segments with start and end times, and identify the speaker for each segment. Format the output as a JSON array of objects, where each object has 'start', 'end', 'text', and 'speaker' fields. For example: [{'start': '00:00', 'end': '00:05', 'text': 'Hello world.', 'speaker': 'Speaker 1'}]";

        console.log('Sending transcription request to Gemini...');
        
        // Add timeout to the API call
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Transcription timeout after 5 minutes')), 5 * 60 * 1000);
        });

        const transcriptionPromise = model.generateContent({
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

        const result = await Promise.race([transcriptionPromise, timeoutPromise]);
        const response = await result.response;
        const transcriptContent = JSON.parse(response.text());
        
        console.log(`Transcription completed with ${transcriptContent.length} segments`);

        // Update transcript with results
        transcript.transcript = transcriptContent;
        transcript.status = 'completed';
        await transcript.save();

        // Cleanup temp file
        fs.unlink(tempMp3Path, () => {});

        console.log(`Transcription retry successful for ${transcriptId}`);

        res.status(200).json({
            message: 'Transcription retry completed successfully',
            transcript: transcript,
            segmentCount: transcriptContent.length
        });

    } catch (error) {
        console.error(`Transcription retry failed for ${transcriptId}:`, error);
        
        // Update transcript status to failed
        try {
            const transcript = await Transcript.findById(transcriptId);
            if (transcript) {
                transcript.status = 'failed';
                await transcript.save();
            }
        } catch (updateError) {
            console.error('Failed to update transcript status:', updateError);
        }

        res.status(500).json({ 
            error: 'Transcription retry failed',
            details: error.message 
        });
    }
});

module.exports = router;