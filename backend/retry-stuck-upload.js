const mongoose = require('mongoose');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const connectDB = require('./src/db');

async function retryStuckUpload() {
    try {
        await connectDB();
        
        const Transcript = require('./src/models/Transcript');
        const storage = new Storage();
        const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');
        
        // Find the stuck upload
        const transcript = await Transcript.findById('687c45adae0378e9910349da');
        
        if (!transcript) {
            console.log('Transcript not found');
            return;
        }
        
        console.log('Found stuck transcript, restarting processing...');
        console.log('Current status:', transcript.status);
        
        const videoPath = path.join('uploads/imports', transcript._id + '.mp4');
        
        if (!fs.existsSync(videoPath)) {
            console.log('Video file not found:', videoPath);
            return;
        }
        
        console.log('Video file exists, starting conversion...');
        
        // Update status to converting
        transcript.status = 'converting';
        await transcript.save();
        
        // Convert to MP3
        const mp3Path = videoPath + '.mp3';
        const thumbnailPath = videoPath + '_thumbnail.jpg';
        
        console.log('Converting to MP3...');
        await new Promise((resolve, reject) => {
            const ffmpegCmd = `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${mp3Path}"`;
            exec(ffmpegCmd, (error) => {
                if (error) {
                    console.error('MP3 conversion failed:', error.message);
                    reject(error);
                } else {
                    console.log('MP3 conversion completed');
                    resolve();
                }
            });
        });
        
        // Generate thumbnail
        console.log('Generating thumbnail...');
        try {
            await new Promise((resolve, reject) => {
                const thumbnailCmd = `ffmpeg -y -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
                exec(thumbnailCmd, (error) => {
                    if (error) {
                        console.warn('Thumbnail generation failed:', error.message);
                        resolve(); // Continue even if thumbnail fails
                    } else {
                        console.log('Thumbnail generated');
                        resolve();
                    }
                });
            });
        } catch (thumbnailError) {
            console.warn('Thumbnail generation failed:', thumbnailError);
        }
        
        // Upload files to cloud storage
        console.log('Uploading to cloud storage...');
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
        
        const uploadResults = await Promise.all(uploadPromises);
        
        // Update transcript with URLs
        transcript.videoUrl = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${videoBlobPath}`;
        transcript.mp3Url = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${mp3BlobPath}`;
        
        if (fs.existsSync(thumbnailPath)) {
            transcript.thumbnailUrl = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${thumbnailBlobPath}`;
        }
        
        console.log('Upload completed, starting transcription...');
        
        // Update status to transcribing
        transcript.status = 'transcribing';
        await transcript.save();
        
        console.log('Processing completed successfully. Transcript status updated to transcribing.');
        console.log('Video URL:', transcript.videoUrl);
        console.log('MP3 URL:', transcript.mp3Url);
        
        // Now trigger transcription
        const { GoogleGenerativeAI, GoogleAIFileManager } = require('@google/generative-ai');
        
        console.log('Starting Gemini transcription...');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

        // Upload the local MP3 file to Gemini File API
        const uploadResult = await fileManager.uploadFile(mp3Path, {
            mimeType: 'audio/mpeg',
            displayName: path.basename(mp3Path)
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

        const response = await result.response;
        const transcriptContent = JSON.parse(response.text());

        console.log('Transcription completed, word count:', transcriptContent.length);

        // Save transcript to database
        transcript.transcript = transcriptContent;
        transcript.status = 'completed';
        await transcript.save();

        console.log('Transcript saved successfully with word-level timestamps!');
        
        // Clean up local files
        try {
            fs.unlinkSync(videoPath);
            fs.unlinkSync(mp3Path);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
            console.log('Temporary files cleaned up');
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary files:', cleanupError.message);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Retry failed:', error.message);
        
        // Update status to failed
        try {
            const Transcript = require('./src/models/Transcript');
            const transcript = await Transcript.findById('687c45adae0378e9910349da');
            if (transcript) {
                transcript.status = 'failed';
                await transcript.save();
            }
        } catch (updateError) {
            console.error('Failed to update status to failed:', updateError.message);
        }
        
        process.exit(1);
    }
}

retryStuckUpload();