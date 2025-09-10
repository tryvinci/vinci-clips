const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Transcript = require('../models/Transcript');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

async function processVideo(transcriptId, videoPath, originalFilename, userId, duration) {
    console.log(`[Processor] Starting: TranscriptID=${transcriptId}, LocalVideoPath=${videoPath}`);
    
    const parsedPath = path.parse(videoPath);
    const mp3Path = path.join(parsedPath.dir, `${parsedPath.name}.mp3`);
    const thumbnailPath = path.join(parsedPath.dir, `${parsedPath.name}_thumbnail.jpg`);
    let transcript;

    try {
        transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            throw new Error(`Transcript with ID ${transcriptId} not found.`);
        }

        transcript.originalFilename = originalFilename;
        transcript.status = 'converting';
        await transcript.save();
        console.log(`[Processor] Status -> converting`);

        // 1. Generate thumbnail from the local video file
        const thumbnailCmd = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
        try {
            await new Promise((resolve, reject) => {
                exec(thumbnailCmd, (error) => error ? reject(error) : resolve());
            });
            console.log(`[Processor] Thumbnail generated`);
        } catch (thumbnailError) {
            console.warn(`[Processor] Thumbnail generation failed: ${thumbnailError}`);
        }

        // 2. Convert video to MP3
        const ffmpegCmd = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${mp3Path}"`;
        await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error) => {
                if (error) return reject(new Error(`ffmpeg error: ${error.message}`));
                resolve();
            });
        });
        console.log(`[Processor] MP3 conversion successful`);

        // 3. Upload the original video and all derivatives to GCS
        const userPrefix = `users/${userId}`;
        const videoBlobPath = `${userPrefix}/videos/${originalFilename}`;
        const mp3BlobName = originalFilename.replace(/\.[^/.]+$/, ".mp3");
        const thumbnailBlobName = originalFilename.replace(/\.[^/.]+$/, "_thumbnail.jpg");

        const videoBlob = bucket.file(videoBlobPath);
        const mp3Blob = bucket.file(`${userPrefix}/audio/${mp3BlobName}`);
        const thumbnailBlob = bucket.file(`${userPrefix}/thumbnails/${thumbnailBlobName}`);

        console.log(`[Processor] Uploading files to GCS...`);
        await Promise.all([
            videoBlob.save(fs.readFileSync(videoPath)),
            mp3Blob.save(fs.readFileSync(mp3Path)),
            fs.existsSync(thumbnailPath) ? thumbnailBlob.save(fs.readFileSync(thumbnailPath)) : Promise.resolve()
        ]);
        console.log(`[Processor] GCS uploads complete`);

        // 4. Construct public URLs
        const videoUrl = `https://storage.googleapis.com/${bucket.name}/${videoBlobPath}`;
        const mp3Url = `https://storage.googleapis.com/${bucket.name}/${userPrefix}/audio/${mp3BlobName}`;
        let thumbnailUrl = null;
        if (fs.existsSync(thumbnailPath)) {
            thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${userPrefix}/thumbnails/${thumbnailBlobName}`;
        }

        transcript.status = 'transcribing';
        await transcript.save();
        console.log(`[Processor] Status -> transcribing`);

        // 5. Transcribe using the uploaded local MP3
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
        const uploadResult = await fileManager.uploadFile(mp3Path, { mimeType: 'audio/mpeg', displayName: mp3BlobName });
        
        const model = genAI.getGenerativeModel({ model: process.env.LLM_MODEL || 'gemini-1.5-flash' });
        const audioPart = { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } };
        const prompt = "Transcribe the provided audio with word-level timestamps and identify the speaker for each word. Format the output as a JSON array of objects, where each object represents a single word with precise millisecond timing. Each object should have 'start' (in format MM:SS:mmm), 'end' (in format MM:SS:mmm), 'text' (single word), and 'speaker' fields. For example: [{'start': '00:00:000', 'end': '00:00:450', 'text': 'Hello', 'speaker': 'Speaker 1'}, {'start': '00:00:450', 'end': '00:00:890', 'text': 'world', 'speaker': 'Speaker 1'}]";
        
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }, audioPart] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { start: { type: 'STRING' }, end: { type: 'STRING' }, text: { type: 'STRING' }, speaker: { type: 'STRING' }, }, required: ['start', 'end', 'text', 'speaker'], }, },
            },
        });

        const response = await result.response;
        const transcriptContent = JSON.parse(response.text());
        console.log(`[Processor] Transcription complete`);

        // 6. Final database update
        transcript.transcript = transcriptContent;
        transcript.videoUrl = videoUrl;
        transcript.videoCloudPath = videoBlobPath;
        transcript.mp3Url = mp3Url;
        transcript.duration = duration;
        transcript.thumbnailUrl = thumbnailUrl;
        transcript.status = 'completed';
        await transcript.save();
        console.log(`[Processor] Status -> completed. Transcript ${transcriptId} finished.`);

    } catch (error) {
        console.error(`[Processor] FATAL ERROR for transcript ${transcriptId}:`, error);
        if (transcript) {
            transcript.status = 'failed';
            await transcript.save();
        }
    } finally {
        // 7. Clean up all temporary local files
        fs.unlink(videoPath, () => {});
        fs.unlink(mp3Path, () => {});
        if (fs.existsSync(thumbnailPath)) {
            fs.unlink(thumbnailPath, () => {});
        }
        console.log(`[Processor] Local file cleanup for ${transcriptId}`);
    }
}

module.exports = { processVideo };