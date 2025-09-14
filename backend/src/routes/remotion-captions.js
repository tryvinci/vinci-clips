const express = require('express');
const router = express.Router();
const Transcript = require('../models/Transcript');
const path = require('path');
const fs = require('fs');
const { bundle } = require('@remotion/bundler');
const { renderMedia, getCompositions } = require('@remotion/renderer');

/**
 * Get all available videos for captioning
 * GET /clips/remotion-captions/videos
 */
router.get('/videos', async (req, res) => {
    try {
        const transcripts = await Transcript.find();
        
        // Filter transcripts that have completed processing and have video files
        const availableVideos = transcripts
            .filter(transcript => 
                transcript.status === 'completed' && 
                transcript.videoUrl && 
                transcript.title
            )
            .map(transcript => ({
                id: transcript._id,
                title: transcript.title,
                duration: transcript.duration,
                videoUrl: transcript.videoUrl,
                thumbnailUrl: transcript.thumbnailUrl,
                createdAt: transcript.createdAt,
                hasTranscript: transcript.transcript && transcript.transcript.length > 0
            }));

        res.json({
            success: true,
            videos: availableVideos,
            count: availableVideos.length
        });

    } catch (error) {
        console.error('Error fetching videos for captioning:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch videos',
            details: error.message
        });
    }
});

/**
 * Generate captioned video using Remotion
 * POST /clips/remotion-captions/generate
 */
router.post('/generate', async (req, res) => {
    try {
        const { 
            transcriptId, 
            style = 'modern',
            startTime,
            endTime,
            captionSettings = {}
        } = req.body;

        if (!transcriptId) {
            return res.status(400).json({
                success: false,
                error: 'Transcript ID is required'
            });
        }

        // Get transcript data
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            return res.status(404).json({
                success: false,
                error: 'Transcript not found'
            });
        }

        if (transcript.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Transcript not ready for caption generation'
            });
        }

        // Prepare caption data from transcript
        let words = [];
        if (transcript.transcript && Array.isArray(transcript.transcript)) {
            words = convertTranscriptToWords(transcript.transcript, startTime, endTime);
        }

        if (words.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No caption data found in specified range'
            });
        }

        // Create Remotion composition input data
        const compositionInput = {
            videoUrl: transcript.videoUrl,
            words: words,
            style: style,
            settings: {
                fontSize: captionSettings.fontSize || 48,
                fontFamily: captionSettings.fontFamily || 'Arial',
                color: captionSettings.color || '#FFFFFF',
                backgroundColor: captionSettings.backgroundColor || 'rgba(0,0,0,0.7)',
                position: captionSettings.position || 'bottom',
                ...captionSettings
            },
            duration: calculateDuration(words),
            startTime: startTime || 0,
            endTime: endTime || transcript.duration
        };

        // Bundle and render the Remotion composition
        const bundleLocation = await bundle({
            entryPoint: path.join(__dirname, '../remotion/composition.tsx'),
            webpackOverride: (config) => config,
        });

        const compositions = await getCompositions(bundleLocation, {
            inputProps: compositionInput,
        });

        const composition = compositions.find((c) => c.id === 'CaptionedVideo');
        if (!composition) {
            throw new Error('Captioned video composition not found');
        }

        // Create output directory
        const outputDir = path.join(__dirname, '../../uploads/remotion-captions');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFileName = `${transcriptId}_remotion_${style}_${Date.now()}.mp4`;
        const outputPath = path.join(outputDir, outputFileName);

        // Render the video
        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: outputPath,
            inputProps: compositionInput,
        });

        const captionedVideoUrl = `/uploads/remotion-captions/${outputFileName}`;

        res.json({
            success: true,
            captionedVideoUrl,
            style,
            wordCount: words.length,
            outputPath,
            message: 'Remotion captioned video generated successfully'
        });

    } catch (error) {
        console.error('Remotion caption generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate Remotion captioned video',
            details: error.message
        });
    }
});

/**
 * Get available caption styles
 * GET /clips/remotion-captions/styles
 */
router.get('/styles', (req, res) => {
    const styles = {
        'modern': {
            name: 'Modern',
            description: 'Clean, modern look with subtle animations',
            preview: '/previews/modern-style.png'
        },
        'dynamic': {
            name: 'Dynamic',
            description: 'Energetic with bounce animations and vibrant colors',
            preview: '/previews/dynamic-style.png'
        },
        'elegant': {
            name: 'Elegant',
            description: 'Sophisticated typography with smooth transitions',
            preview: '/previews/elegant-style.png'
        },
        'playful': {
            name: 'Playful',
            description: 'Fun and colorful with creative animations',
            preview: '/previews/playful-style.png'
        },
        'minimalist': {
            name: 'Minimalist',
            description: 'Simple, clean design focusing on readability',
            preview: '/previews/minimalist-style.png'
        }
    };

    res.json({
        success: true,
        styles
    });
});

// Helper functions
function convertTranscriptToWords(segments, startTime, endTime) {
    let words = [];
    
    segments.forEach(segment => {
        if (segment.text && segment.start !== undefined && segment.end !== undefined) {
            const segmentWords = segment.text.split(/\s+/);
            const segmentDuration = parseFloat(segment.end) - parseFloat(segment.start);
            const wordDuration = segmentDuration / segmentWords.length;
            
            segmentWords.forEach((word, index) => {
                const wordStart = parseFloat(segment.start) + (index * wordDuration);
                const wordEnd = wordStart + wordDuration;
                
                // Filter by time range if specified
                if (startTime !== undefined && endTime !== undefined) {
                    if (wordStart >= startTime && wordEnd <= endTime) {
                        words.push({
                            text: word.replace(/[.,!?;]/g, ''),
                            start: wordStart,
                            end: wordEnd,
                            speaker: segment.speaker || 'unknown'
                        });
                    }
                } else {
                    words.push({
                        text: word.replace(/[.,!?;]/g, ''),
                        start: wordStart,
                        end: wordEnd,
                        speaker: segment.speaker || 'unknown'
                    });
                }
            });
        }
    });
    
    return words;
}

function calculateDuration(words) {
    if (words.length === 0) return 0;
    const lastWord = words[words.length - 1];
    return lastWord.end;
}

module.exports = router;