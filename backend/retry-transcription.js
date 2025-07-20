const mongoose = require('mongoose');
const { GoogleGenerativeAI, GoogleAIFileManager } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./src/db');

async function retryTranscription() {
    try {
        await connectDB();
        
        const Transcript = require('./src/models/Transcript');
        const transcript = await Transcript.findById('687c4bfadbe55cde9a079ac9');
        
        if (!transcript) {
            console.log('Transcript not found');
            return;
        }
        
        console.log('Found stuck transcript:', transcript.originalFilename);
        console.log('Current status:', transcript.status);
        console.log('MP3 URL:', transcript.mp3Url);
        
        if (!transcript.mp3Url) {
            console.log('No MP3 URL available, cannot retry transcription');
            return;
        }
        
        // Check if we have local MP3 file
        const mp3Path = `uploads/imports/${transcript._id}.mp4.mp3`;
        if (!fs.existsSync(mp3Path)) {
            console.log('Local MP3 file not found:', mp3Path);
            console.log('Trying to use cloud MP3 URL for transcription...');
            
            // We'll need to download the MP3 from cloud storage
            // For now, let's just report the issue
            transcript.status = 'failed';
            await transcript.save();
            console.log('Updated status to failed - MP3 file not available locally');
            return;
        }
        
        console.log('Starting Gemini transcription with word-level timestamps...');
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

        // Upload the local MP3 file to Gemini File API
        console.log('Uploading MP3 to Gemini...');
        const uploadResult = await fileManager.uploadFile(mp3Path, {
            mimeType: 'audio/mpeg',
            displayName: path.basename(mp3Path)
        });
        
        console.log('MP3 uploaded to Gemini, starting transcription...');

        const model = genAI.getGenerativeModel({
            model: process.env.LLM_MODEL || 'gemini-1.5-flash',
        });
        
        const audioPart = { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } };

        const prompt = "Transcribe the provided audio with word-level timestamps and identify the speaker for each word. Format the output as a JSON array of objects, where each object represents a single word with precise millisecond timing. Each object should have 'start' (in format MM:SS:mmm), 'end' (in format MM:SS:mmm), 'text' (single word), and 'speaker' fields. For example: [{'start': '00:00:000', 'end': '00:00:450', 'text': 'Hello', 'speaker': 'Speaker 1'}, {'start': '00:00:450', 'end': '00:00:890', 'text': 'world', 'speaker': 'Speaker 1'}]";

        console.log('Sending transcription request to Gemini...');
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    audioPart,
                ],
            }],
            generationConfig: {
                audioTimestamp: true,
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

        console.log('Transcription completed, processing response...');
        const response = await result.response;
        const transcriptContent = JSON.parse(response.text());

        console.log('Word-level transcript generated:');
        console.log('Total words:', transcriptContent.length);
        console.log('First few words:', transcriptContent.slice(0, 5));

        // Save transcript to database
        transcript.transcript = transcriptContent;
        transcript.status = 'completed';
        await transcript.save();

        console.log('Transcript saved successfully with word-level timestamps!');
        console.log('Status updated to completed');
        
        // Clean up local files
        try {
            const videoPath = `uploads/imports/${transcript._id}.mp4`;
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
            if (fs.existsSync(mp3Path)) {
                fs.unlinkSync(mp3Path);
            }
            console.log('Temporary files cleaned up');
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary files:', cleanupError.message);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Transcription retry failed:', error.message);
        
        // Update status to failed
        try {
            const Transcript = require('./src/models/Transcript');
            const transcript = await Transcript.findById('687c4bfadbe55cde9a079ac9');
            if (transcript) {
                transcript.status = 'failed';
                await transcript.save();
                console.log('Updated status to failed due to error');
            }
        } catch (updateError) {
            console.error('Failed to update status to failed:', updateError.message);
        }
        
        process.exit(1);
    }
}

retryTranscription();