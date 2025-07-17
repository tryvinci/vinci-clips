const express = require('express');
const { ObjectId } = require('mongodb');
const connectDB = require('../db');
const Transcript = require('../models/Transcript');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

router.get('/clips/:transcriptId', async (req, res) => {
    const { transcriptId } = req.params;

    if (!transcriptId) {
        return res.status(400).send('Transcript ID is required.');
    }

    try {
        const db = await connectDB();
        const clipsCollection = db.collection('clips');
        
        const clipsDoc = await clipsCollection.findOne({ transcriptId: new ObjectId(transcriptId) });

        if (!clipsDoc) {
            return res.status(404).send('Clips not found for the given transcript ID.');
        }

        res.status(200).json(clipsDoc);
    } catch (error) {
        console.error('Error fetching clips:', error);
        res.status(500).send('Failed to fetch clips.');
    }
});

// Generate actual video clips from analyzed clips
router.post('/generate/:transcriptId', async (req, res) => {
    const { transcriptId } = req.params;
    const { clipIndex } = req.body; // Optional: generate specific clip by index

    try {
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found.' });
        }

        if (!transcript.clips || transcript.clips.length === 0) {
            return res.status(400).json({ error: 'No clips found. Run analysis first.' });
        }

        const clipsToGenerate = clipIndex !== undefined ? [transcript.clips[clipIndex]] : transcript.clips;
        const generatedClips = [];

        // Ensure clips directory exists
        const clipsDir = 'uploads/clips';
        if (!fs.existsSync(clipsDir)) {
            fs.mkdirSync(clipsDir, { recursive: true });
        }

        for (let i = 0; i < clipsToGenerate.length; i++) {
            const clip = clipsToGenerate[i];
            const actualIndex = clipIndex !== undefined ? clipIndex : i;
            
            try {
                const outputPath = path.join(clipsDir, `${transcriptId}_clip_${actualIndex}.mp4`);
                
                // Download original video to temp location using stored cloud path
                const tempVideoPath = path.join('uploads', `temp_${transcriptId}.mp4`);
                const cloudPath = transcript.videoCloudPath || `videos/${transcript.originalFilename}`;
                const videoFile = bucket.file(cloudPath);
                
                console.log(`Downloading video from cloud path: ${cloudPath}`);
                await videoFile.download({ destination: tempVideoPath });

                let ffmpegCmd;
                
                if (clip.segments && clip.segments.length > 0) {
                    // Multi-segment clip - need to concatenate segments
                    const segmentFiles = [];
                    
                    for (let j = 0; j < clip.segments.length; j++) {
                        const segment = clip.segments[j];
                        const segmentPath = path.join(clipsDir, `${transcriptId}_clip_${actualIndex}_segment_${j}.mp4`);
                        
                        const segmentCmd = `ffmpeg -i "${tempVideoPath}" -ss ${segment.start} -t ${segment.end - segment.start} -c copy "${segmentPath}"`;
                        
                        await new Promise((resolve, reject) => {
                            exec(segmentCmd, (error) => {
                                if (error) reject(error);
                                else resolve();
                            });
                        });
                        
                        segmentFiles.push(segmentPath);
                    }
                    
                    // Create concat file for FFmpeg
                    const concatFilePath = path.join(clipsDir, `${transcriptId}_clip_${actualIndex}_concat.txt`);
                    const concatContent = segmentFiles.map(file => `file '${path.resolve(file)}'`).join('\n');
                    fs.writeFileSync(concatFilePath, concatContent);
                    
                    // Concatenate segments
                    ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}"`;
                    
                    await new Promise((resolve, reject) => {
                        exec(ffmpegCmd, (error) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                    
                    // Cleanup segment files and concat file
                    segmentFiles.forEach(file => fs.unlink(file, () => {}));
                    fs.unlink(concatFilePath, () => {});
                    
                } else if (clip.start !== undefined && clip.end !== undefined) {
                    // Single segment clip
                    const duration = clip.end - clip.start;
                    ffmpegCmd = `ffmpeg -i "${tempVideoPath}" -ss ${clip.start} -t ${duration} -c copy "${outputPath}"`;
                    
                    await new Promise((resolve, reject) => {
                        exec(ffmpegCmd, (error) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                }

                // Upload generated clip to cloud storage
                const clipBlobName = `clips/${transcriptId}_clip_${actualIndex}.mp4`;
                await bucket.upload(outputPath, { destination: clipBlobName });
                
                const [clipUrl] = await bucket.file(clipBlobName).getSignedUrl({
                    action: 'read',
                    expires: '03-09-2491'
                });

                generatedClips.push({
                    index: actualIndex,
                    title: clip.title,
                    url: clipUrl,
                    localPath: outputPath
                });

                // Cleanup local file
                fs.unlink(outputPath, () => {});

            } catch (clipError) {
                console.error(`Error generating clip ${actualIndex}:`, clipError);
            }
        }

        // Cleanup temp video file
        const tempVideoPath = path.join('uploads', `temp_${transcriptId}.mp4`);
        fs.unlink(tempVideoPath, () => {});

        if (generatedClips.length === 0) {
            return res.status(500).json({ error: 'Failed to generate any clips.' });
        }

        res.json({
            message: `Generated ${generatedClips.length} clip(s) successfully.`,
            clips: generatedClips
        });

    } catch (error) {
        console.error('Error generating clips:', error);
        res.status(500).json({ error: 'Failed to generate clips.' });
    }
});

module.exports = router; 