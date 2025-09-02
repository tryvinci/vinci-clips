const express = require('express');
const Transcript = require('../models/Transcript');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const router = express.Router();


// Generate actual video clips from analyzed clips
router.post('/generate/:transcriptId', async (req, res) => {
    const { transcriptId } = req.params;
    const { clipIndex } = req.body; // Optional: generate specific clip by index

    try {
        // Validate transcript ID format

        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found.' });
        }

        if (!transcript.clips || transcript.clips.length === 0) {
            return res.status(400).json({ error: 'No clips found. Run analysis first.' });
        }

        // Validate clip index if provided
        if (clipIndex !== undefined && (clipIndex < 0 || clipIndex >= transcript.clips.length)) {
            return res.status(400).json({ 
                error: `Invalid clip index. Must be between 0 and ${transcript.clips.length - 1}.` 
            });
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
                const outputFilename = `${transcriptId}_clip_${actualIndex}.mp4`;
                const outputPath = path.join(clipsDir, outputFilename);
                const clipUrl = `/uploads/clips/${outputFilename}`;

                // Check if the clip already exists
                if (fs.existsSync(outputPath)) {
                    console.log(`Clip ${actualIndex} already exists. Returning existing file.`);
                    generatedClips.push({
                        index: actualIndex,
                        title: clip.title,
                        url: clipUrl,
                        localPath: outputPath
                    });
                    continue; // Skip to the next clip
                }
                
                // Use absolute path for the source video
                const videoPath = path.join(__dirname, '..', '..', 'uploads', path.basename(transcript.videoUrl));

                let ffmpegCmd;
                
                if (clip.segments && clip.segments.length > 0) {
                    // Multi-segment clip - need to concatenate segments
                    const segmentFiles = [];
                    
                    for (let j = 0; j < clip.segments.length; j++) {
                        const segment = clip.segments[j];
                        const segmentPath = path.join(clipsDir, `${transcriptId}_clip_${actualIndex}_segment_${j}.mp4`);
                        
                        const segmentCmd = `ffmpeg -i "${videoPath}" -ss ${segment.start} -t ${segment.end - segment.start} "${segmentPath}"`;
                        
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
                    ffmpegCmd = `ffmpeg -i "${videoPath}" -ss ${clip.start} -t ${duration} "${outputPath}"`;
                    
                    await new Promise((resolve, reject) => {
                        exec(ffmpegCmd, (error) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                }

                generatedClips.push({
                    index: actualIndex,
                    title: clip.title,
                    url: clipUrl,
                    localPath: outputPath
                });

            } catch (clipError) {
                console.error(`Error generating clip ${actualIndex}:`, clipError);
                // Return more specific error information
                return res.status(500).json({ 
                    error: `Failed to generate clip ${actualIndex + 1}`,
                    details: clipError.message,
                    clipIndex: actualIndex
                });
            }
        }

        // Cleanup temp video file

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