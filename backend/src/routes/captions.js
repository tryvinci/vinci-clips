const express = require('express');
const router = express.Router();
const Transcript = require('../models/Transcript');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');


// Caption style presets for TikTok/Reels
const CAPTION_STYLES = {
    'bold-center': {
        name: 'Bold Center',
        description: 'Heavy sans-serif, center-aligned, white text with black outline',
        fontfile: '/System/Library/Fonts/Helvetica.ttc',
        fontsize: 48,
        fontcolor: 'white',
        borderw: 3,
        bordercolor: 'black',
        alignment: 2, // center
        y: 'h-th-50', // bottom area
    },
    'neon-pop': {
        name: 'Neon Pop',
        description: 'Bright gradient colors, bold fonts, drop shadows',
        fontfile: '/System/Library/Fonts/Helvetica.ttc',
        fontsize: 52,
        fontcolor: '#FF6B9D',
        borderw: 2,
        bordercolor: '#FFD93D',
        alignment: 2,
        y: 'h-th-50',
        shadow: '2:2:4:0.5',
    },
    'typewriter': {
        name: 'Typewriter',
        description: 'Monospace fonts, word-by-word appearance',
        fontfile: '/System/Library/Fonts/Courier.ttc',
        fontsize: 44,
        fontcolor: 'white',
        borderw: 2,
        bordercolor: 'black',
        alignment: 2,
        y: 'h-th-50',
    },
    'bubble': {
        name: 'Bubble Style',
        description: 'Rounded backgrounds, colorful overlays, soft shadows',
        fontfile: '/System/Library/Fonts/Helvetica.ttc',
        fontsize: 46,
        fontcolor: 'white',
        borderw: 4,
        bordercolor: '#4ECDC4',
        alignment: 2,
        y: 'h-th-50',
        box: 1,
        boxcolor: 'black@0.6',
        boxborderw: 8,
    },
    'minimal-clean': {
        name: 'Minimal Clean',
        description: 'Light fonts, subtle backgrounds, elegant spacing',
        fontfile: '/System/Library/Fonts/Helvetica.ttc',
        fontsize: 42,
        fontcolor: 'white',
        borderw: 1,
        bordercolor: 'black@0.3',
        alignment: 2,
        y: 'h-th-50',
        box: 1,
        boxcolor: 'black@0.2',
    }
};

// Helper function to convert MM:SS or MM:SS:mmm to seconds
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const minutes = parseInt(parts[0]);
    const seconds = parseInt(parts[1]);
    const milliseconds = parts[2] ? parseInt(parts[2]) : 0;
    return minutes * 60 + seconds + (milliseconds / 1000);
}

// Helper function to convert segment-level transcript to word-level for captions
function convertToWordLevel(segments) {
    const words = [];
    
    segments.forEach(segment => {
        const startTime = timeToSeconds(segment.start);
        const endTime = timeToSeconds(segment.end);
        const duration = endTime - startTime;
        const text = segment.text.trim();
        const wordsInSegment = text.split(/\s+/);
        
        // Distribute timing evenly across words in the segment
        const timePerWord = duration / wordsInSegment.length;
        
        wordsInSegment.forEach((word, index) => {
            const wordStart = startTime + (index * timePerWord);
            const wordEnd = wordStart + timePerWord;
            
            // Format back to MM:SS:mmm
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                const ms = Math.floor((seconds % 1) * 1000);
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
            };
            
            words.push({
                start: formatTime(wordStart),
                end: formatTime(wordEnd),
                text: word.replace(/[.,!?;]/g, ''), // Remove punctuation
                speaker: segment.speaker
            });
        });
    });
    
    return words;
}

// Helper function to build SRT subtitle content
function buildSRTContent(words) {
    if (!Array.isArray(words) || words.length === 0) {
        throw new Error('Words array is empty or invalid');
    }
    
    console.log('Debug: Building SRT content for', words.length, 'words');
    
    // Group words into phrases to reduce the number of subtitle entries
    // This helps avoid overwhelming the viewer with too many individual words
    const phrases = [];
    let currentPhrase = [];
    let phraseStart = null;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        if (!word || !word.start || !word.end || !word.text) {
            console.warn(`Skipping invalid word at index ${i}:`, word);
            continue;
        }
        
        if (phraseStart === null) {
            phraseStart = word.start;
        }
        
        currentPhrase.push(word.text);
        
        // End phrase after 3-5 words or at natural breaks
        const shouldEndPhrase = currentPhrase.length >= 4 || 
                               word.text.match(/[.!?]$/) ||
                               i === words.length - 1;
        
        if (shouldEndPhrase) {
            phrases.push({
                start: phraseStart,
                end: word.end,
                text: currentPhrase.join(' ')
            });
            currentPhrase = [];
            phraseStart = null;
        }
    }
    
    console.log(`Debug: Created ${phrases.length} phrases from ${words.length} words`);
    
    // Convert phrases to SRT format
    let srtContent = '';
    phrases.forEach((phrase, index) => {
        const startTime = convertToSRTTime(phrase.start);
        const endTime = convertToSRTTime(phrase.end);
        
        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${phrase.text}\n\n`;
    });
    
    return srtContent;
}

// Helper function to convert time format to SRT format (HH:MM:SS,mmm)
function convertToSRTTime(timeStr) {
    // Handle MM:SS:mmm format
    const parts = timeStr.split(':');
    let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
    
    if (parts.length === 3) {
        // MM:SS:mmm format
        minutes = parseInt(parts[0]);
        seconds = parseInt(parts[1]);
        milliseconds = parseInt(parts[2]) || 0;
    } else if (parts.length === 2) {
        // MM:SS format
        minutes = parseInt(parts[0]);
        seconds = parseInt(parts[1]);
    }
    
    // Convert to SRT format: HH:MM:SS,mmm
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Helper function to create styled subtitle filter for SRT
function buildSubtitleStyleFilter(style) {
    // Create FFmpeg subtitle style filter
    const subtitleStyle = [
        `FontName=${style.fontfile.replace('/System/Library/Fonts/', '').replace('.ttc', '')}`,
        `FontSize=${style.fontsize}`,
        `PrimaryColour=${convertColorToASS(style.fontcolor)}`,
        `OutlineColour=${convertColorToASS(style.bordercolor)}`,
        `Outline=${style.borderw}`,
        `Alignment=2`, // Center alignment
        `MarginV=50` // Bottom margin
    ];
    
    if (style.shadow) {
        subtitleStyle.push(`Shadow=2`);
    }
    
    return subtitleStyle.join(',');
}

// Helper function to convert color to ASS format
function convertColorToASS(color) {
    if (color === 'white') return '&H00FFFFFF';
    if (color === 'black') return '&H00000000';
    if (color.startsWith('#')) {
        // Convert hex to BGR format for ASS
        const hex = color.slice(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `&H00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    return '&H00FFFFFF'; // Default to white
}

// GET /captions/styles - Get available caption styles
router.get('/styles', (req, res) => {
    res.json({
        success: true,
        styles: Object.keys(CAPTION_STYLES).map(key => ({
            id: key,
            name: CAPTION_STYLES[key].name,
            description: CAPTION_STYLES[key].description
        }))
    });
});

// POST /captions/generate/:id - Generate captioned video
router.post('/generate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { style = 'bold-center', startTime, endTime } = req.body;

        // Validate style
        if (!CAPTION_STYLES[style]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid caption style'
            });
        }

        // Get transcript
        const transcript = await Transcript.findById(id);
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

        // Convert segment-level transcript to word-level if needed
        let words;
        console.log('Debug: transcript.transcript type:', typeof transcript.transcript);
        console.log('Debug: transcript.transcript length:', transcript.transcript?.length);
        console.log('Debug: transcript.transcript exists:', !!transcript.transcript);
        
        if (transcript.transcript && Array.isArray(transcript.transcript) && transcript.transcript.length > 0) {
            console.log('Debug: First segment structure:', JSON.stringify(transcript.transcript[0], null, 2));
            
            // Check if we have word-level data (individual words) or segment-level (sentences)
            const firstSegment = transcript.transcript[0];
            if (!firstSegment || !firstSegment.text) {
                throw new Error('Invalid transcript format: missing text field');
            }
            
            const isWordLevel = firstSegment.text.split(/\s+/).length === 1;
            console.log('Debug: Is word level?', isWordLevel);
            console.log('Debug: First segment text:', firstSegment.text);
            
            if (isWordLevel) {
                // Already word-level, use as-is
                words = transcript.transcript;
            } else {
                // Convert segment-level to word-level
                console.log('Debug: Converting segment-level to word-level');
                words = convertToWordLevel(transcript.transcript);
                console.log('Debug: Converted words count:', words.length);
                if (words.length > 0) {
                    console.log('Debug: First converted word:', JSON.stringify(words[0], null, 2));
                }
            }
        } else {
            console.log('Debug: No transcript data found');
            words = [];
        }

        // Filter words by time range if specified
        if (startTime !== undefined && endTime !== undefined) {
            words = words.filter(word => {
                const wordStart = timeToSeconds(word.start);
                const wordEnd = timeToSeconds(word.end);
                return wordStart >= startTime && wordEnd <= endTime;
            });
        }

        if (words.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No words found in specified time range'
            });
        }

        // Create temporary file paths
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const outputFileName = `${transcript._id}_captioned_${style}_${Date.now()}.mp4`;
        const outputPath = path.join(tempDir, outputFileName);

        // Download original video
        const inputPath = path.join(__dirname, '..', '..', 'uploads', path.basename(transcript.videoUrl));

        // Generate SRT subtitle file
        const captionStyle = CAPTION_STYLES[style];
        const srtContent = buildSRTContent(words);
        const srtPath = path.join(tempDir, `${transcript._id}_captions.srt`);
        
        console.log('Debug: Writing SRT file...');
        fs.writeFileSync(srtPath, srtContent);
        
        console.log('Debug: Starting FFmpeg with subtitle file...');
        
        // Generate captioned video using FFmpeg with SRT subtitles
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    `-vf subtitles=${srtPath}:force_style='FontName=Arial,FontSize=${captionStyle.fontsize},PrimaryColour=${convertColorToASS(captionStyle.fontcolor)},OutlineColour=${convertColorToASS(captionStyle.bordercolor)},Outline=${captionStyle.borderw},Alignment=2,MarginV=80'`,
                    '-c:v libx264',
                    '-c:a aac',
                    '-crf 23',
                    '-preset medium'
                ])
                .output(outputPath)
                .on('end', () => {
                    console.log(`Caption generation completed: ${outputPath}`);
                    // Clean up SRT file
                    try {
                        fs.unlinkSync(srtPath);
                    } catch (e) {
                        console.warn('Failed to clean up SRT file:', e.message);
                    }
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`Caption generation failed: ${err.message}`);
                    // Clean up SRT file
                    try {
                        fs.unlinkSync(srtPath);
                    } catch (e) {
                        console.warn('Failed to clean up SRT file:', e.message);
                    }
                    reject(err);
                })
                .run();
        });

        const destDir = path.join(__dirname, '..', '..', 'uploads', 'captioned');
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const destPath = path.join(destDir, outputFileName);
        fs.renameSync(outputPath, destPath);

        // Clean up temporary files
        // The input path is the original video, we shouldn't delete it
        // try {
        //     fs.unlinkSync(inputPath);
        // } catch (cleanupError) {
        //     console.warn('Failed to clean up temporary files:', cleanupError.message);
        // }

        // Return success with download URL
        const captionedVideoUrl = `/uploads/captioned/${outputFileName}`;

        res.json({
            success: true,
            captionedVideoUrl,
            style: {
                id: style,
                name: captionStyle.name,
                description: captionStyle.description
            },
            wordCount: words.length,
            message: 'Captioned video generated successfully'
        });

    } catch (error) {
        console.error('Caption generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate captioned video',
            details: error.message
        });
    }
});

module.exports = router;