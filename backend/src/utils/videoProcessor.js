const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Transcript = require('../models/Transcript');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

// Ensure a temporary directory exists for processing
const tempDir = path.join(__dirname, '..', '..', 'temp', 'processing');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

async function processVideo(transcriptId, cloudPath, originalFilename, userId, duration) {
    console.log(`[Processor] Starting: TranscriptID=${transcriptId}, CloudPath=${cloudPath}`);
    
    // Create a temporary local path for the video file
    const localVideoPath = path.join(tempDir, `${transcriptId}_${path.basename(cloudPath)}`);
    const parsedPath = path.parse(localVideoPath);
    const mp3Path = path.join(parsedPath.dir, `${parsedPath.name}.mp3`);
    const thumbnailPath = path.join(parsedPath.dir, `${parsedPath.name}_thumbnail.jpg`);
    let transcript;

    try {
        // --- Download the file from GCS to the temporary local path ---
        console.log(`[Processor] Downloading ${cloudPath} to ${localVideoPath}`);
        await bucket.file(cloudPath).download({ destination: localVideoPath });
        console.log(`[Processor] Download complete.`);

        transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            throw new Error(`Transcript with ID ${transcriptId} not found.`);
        }

        transcript.originalFilename = originalFilename;
        transcript.status = 'converting';
        await transcript.save();
        console.log(`[Processor] Status -> converting`);

        const thumbnailCmd = `ffmpeg -i "${localVideoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
        try {
            await new Promise((resolve, reject) => {
                exec(thumbnailCmd, (error) => error ? reject(error) : resolve());
            });
            console.log(`[Processor] Thumbnail generated`);
        } catch (thumbnailError) {
            console.warn(`[Processor] Thumbnail generation failed: ${thumbnailError}`);
        }

        const ffmpegCmd = `ffmpeg -i "${localVideoPath}" -vn -acodec libmp3lame -q:a 2 "${mp3Path}"`;
        await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error) => {
                if (error) return reject(new Error(`ffmpeg error: ${error.message}`));
                resolve();
            });
        });
        console.log(`[Processor] MP3 conversion successful`);

        const userPrefix = `users/${userId}`;
        const mp3BlobName = originalFilename.replace(/\.[^/.]+$/, ".mp3");
        const thumbnailBlobName = originalFilename.replace(/\.[^/.]+$/, "_thumbnail.jpg");

        // The original video is already in GCS, so we only need to upload the MP3 and thumbnail.
        const uploadPromises = [
            bucket.upload(mp3Path, { destination: `${userPrefix}/audio/${mp3BlobName}` })
        ];
        if (fs.existsSync(thumbnailPath)) {
            uploadPromises.push(bucket.upload(thumbnailPath, { destination: `${userPrefix}/thumbnails/${thumbnailBlobName}` }));
        }
        await Promise.all(uploadPromises);
        console.log(`[Processor] GCS uploads for derivatives complete`);

        const [videoUrl] = await bucket.file(cloudPath).getSignedUrl({ action: 'read', expires: '03-09-2491' });
        const [mp3Url] = await bucket.file(`${userPrefix}/audio/${mp3BlobName}`).getSignedUrl({ action: 'read', expires: '03-09-2491' });
        let thumbnailUrl = null;
        if (fs.existsSync(thumbnailPath)) {
            [thumbnailUrl] = await bucket.file(`${userPrefix}/thumbnails/${thumbnailBlobName}`).getSignedUrl({ action: 'read', expires: '03-09-2491' });
        }

        transcript.status = 'transcribing';
        await transcript.save();
        console.log(`[Processor] Status -> transcribing`);

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
                    },
                },
            },
        });

        const response = await result.response;
        const transcriptContent = JSON.parse(response.text());
        console.log(`[Processor] Transcription complete`);

        transcript.transcript = transcriptContent;
        transcript.videoUrl = videoUrl;
        transcript.videoCloudPath = cloudPath; // It was already set, but good to be explicit
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
        // Cleanup all temporary local files
        fs.unlink(localVideoPath, () => {});
        fs.unlink(mp3Path, () => {});
        if (fs.existsSync(thumbnailPath)) {
            fs.unlink(thumbnailPath, () => {});
        }
        console.log(`[Processor] Local file cleanup for ${transcriptId}`);
    }
}

module.exports = { processVideo };