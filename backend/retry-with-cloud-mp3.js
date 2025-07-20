const mongoose = require('mongoose');
const { GoogleGenerativeAI, GoogleAIFileManager } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./src/db');

async function retryWithCloudMp3() {
    try {
        await connectDB();
        
        const Transcript = require('./src/models/Transcript');
        const transcript = await Transcript.findById('687c4bfadbe55cde9a079ac9');
        
        if (!transcript) {
            console.log('Transcript not found');
            return;
        }
        
        console.log('Found transcript:', transcript.originalFilename);
        console.log('Current status:', transcript.status);
        
        if (!transcript.mp3Url) {
            console.log('No MP3 URL available');
            return;
        }
        
        // Download MP3 from cloud storage
        console.log('Downloading MP3 from cloud storage...');
        const storage = new Storage();
        const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');
        
        // Extract the blob path from the MP3 URL
        const mp3UrlParts = transcript.mp3Url.split('/');
        const bucketIndex = mp3UrlParts.findIndex(part => part === process.env.GCP_BUCKET_NAME || part === 'vinci-dev');
        const blobPath = mp3UrlParts.slice(bucketIndex + 1).join('/').split('?')[0]; // Remove query params
        
        console.log('MP3 blob path:', blobPath);
        
        // Download to temporary location
        const tempMp3Path = `uploads/temp/${transcript._id}_temp.mp3`;
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempMp3Path);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const file = bucket.file(blobPath);
        await file.download({ destination: tempMp3Path });
        
        console.log('MP3 downloaded to:', tempMp3Path);
        
        // Update status to transcribing
        transcript.status = 'transcribing';
        await transcript.save();
        
        console.log('Starting Gemini transcription with word-level timestamps...');
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

        // Upload the MP3 file to Gemini File API
        console.log('Uploading MP3 to Gemini...');
        const uploadResult = await fileManager.uploadFile(tempMp3Path, {
            mimeType: 'audio/mpeg',
            displayName: path.basename(tempMp3Path)
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
        
        if (transcriptContent.length > 0) {
            console.log('First few words:');
            transcriptContent.slice(0, 5).forEach((word, i) => {
                console.log(`  ${i+1}. ${word.start}-${word.end}: "${word.text}" (${word.speaker})`);
            });
        }

        // Save transcript to database
        transcript.transcript = transcriptContent;
        transcript.status = 'completed';
        await transcript.save();

        console.log('');
        console.log('✅ SUCCESS: Transcript saved with word-level timestamps!');
        console.log('Status updated to completed');
        console.log('Ready for TikTok/Reels caption generation!');
        
        // Clean up temporary file
        try {
            if (fs.existsSync(tempMp3Path)) {
                fs.unlinkSync(tempMp3Path);
                console.log('Temporary MP3 file cleaned up');
            }
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary file:', cleanupError.message);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Transcription retry failed:', error.message);
        console.error('Error details:', error);
        
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

retryWithCloudMp3();