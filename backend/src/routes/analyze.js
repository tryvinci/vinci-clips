const express = require('express');
const router = express.Router();
const Transcript = require('../models/Transcript');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

router.post('/:transcriptId', async (req, res) => {
    try {
        const transcriptDoc = await Transcript.findById(req.params.transcriptId);
        if (!transcriptDoc) {
            return res.status(404).json({ error: 'Transcript not found.' });
        }

        // Join transcript segments into a single string for analysis by the LLM
        const fullTranscriptText = transcriptDoc.transcript.map(segment => segment.text).join(' ');

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: process.env.LLM_MODEL || 'gemini-1.5-flash',
        });

        const videoDurationText = transcriptDoc.duration ? ` The video is ${Math.floor(transcriptDoc.duration / 60)}:${String(Math.floor(transcriptDoc.duration % 60)).padStart(2, '0')} long.` : '';
        
        const maxTimeFormatted = Math.floor(transcriptDoc.duration / 60) + ':' + String(Math.floor(transcriptDoc.duration % 60)).padStart(2, '0');
        
        const prompt = `Given the following transcript, propose 3-5 video clips that would make engaging short content.${videoDurationText}

CRITICAL CONSTRAINTS:
- Video duration is EXACTLY ${videoDurationText ? maxTimeFormatted : 'unknown'} - DO NOT suggest any timestamps beyond this
- Each clip should be 30-90 seconds total duration
- All timestamps must be in MM:SS format and within 0:00 to ${maxTimeFormatted}

You can suggest two types of clips:

1. SINGLE SEGMENT clips: One continuous segment from start time to end time
2. MULTI-SEGMENT clips: Multiple segments that when combined tell a coherent story

For single segments: provide 'start' and 'end' times in MM:SS format.
For multi-segments: provide an array of segments in 'segments' field, each with 'start' and 'end' times.

VALIDATION RULES:
- Every timestamp must be ≤ ${maxTimeFormatted}
- Total duration must be 30-90 seconds
- Focus on complete thoughts or exchanges
- Ensure segments make sense when combined

Output format: JSON array where each object has:
- 'title': descriptive title
- For single segments: 'start' and 'end' fields  
- For multi-segments: 'segments' array with objects containing 'start' and 'end'

Transcript: ${fullTranscriptText}`;

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }],
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            title: { type: 'STRING' },
                            start: { type: 'STRING' },
                            end: { type: 'STRING' },
                            segments: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    properties: {
                                        start: { type: 'STRING' },
                                        end: { type: 'STRING' },
                                    },
                                    required: ['start', 'end'],
                                },
                            },
                        },
                        required: ['title'],
                        propertyOrdering: ['title', 'start', 'end', 'segments'],
                    },
                },
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        });

        const response = await result.response;
        const suggestedClips = JSON.parse(response.text());
        
        // Convert MM:SS time format to seconds for database storage
        const convertTimeToSeconds = (timeString) => {
            const [minutes, seconds] = timeString.split(':').map(Number);
            return minutes * 60 + seconds;
        };

        // Validate and process clips
        const validatedClips = [];
        const videoDurationSeconds = transcriptDoc.duration || Infinity;
        
        console.log(`Video duration: ${videoDurationSeconds}s (${Math.floor(videoDurationSeconds / 60)}:${String(videoDurationSeconds % 60).padStart(2, '0')})`);
        console.log('Raw suggestions from Gemini:', JSON.stringify(suggestedClips, null, 2));

        for (const clip of suggestedClips) {
            try {
                let totalDuration = 0;
                let processedClip = { title: clip.title };

                if (clip.segments && Array.isArray(clip.segments)) {
                    // Multi-segment clip
                    const processedSegments = [];
                    for (const segment of clip.segments) {
                        const startSeconds = convertTimeToSeconds(segment.start);
                        const endSeconds = convertTimeToSeconds(segment.end);
                        
                        // Validate segment is within video duration
                        if (startSeconds < 0 || endSeconds > videoDurationSeconds || startSeconds >= endSeconds) {
                            console.warn(`Invalid segment in clip "${clip.title}": ${segment.start}-${segment.end} (${startSeconds}s-${endSeconds}s vs max ${videoDurationSeconds}s)`);
                            continue;
                        }
                        
                        processedSegments.push({
                            start: startSeconds,
                            end: endSeconds
                        });
                        totalDuration += (endSeconds - startSeconds);
                    }
                    
                    if (processedSegments.length > 0 && totalDuration >= 30 && totalDuration <= 90) {
                        processedClip.segments = processedSegments;
                        processedClip.totalDuration = totalDuration;
                        validatedClips.push(processedClip);
                        console.log(`✓ Valid multi-segment clip: "${clip.title}" - ${processedSegments.length} segments, ${totalDuration}s total`);
                    } else {
                        const reason = processedSegments.length === 0 ? 'no valid segments' : 
                                     totalDuration < 30 ? 'too short' : 'too long';
                        console.warn(`✗ Rejected multi-segment clip: "${clip.title}" - ${processedSegments.length} segments, ${totalDuration}s total (${reason})`);
                    }
                } else if (clip.start && clip.end) {
                    // Single segment clip
                    const startSeconds = convertTimeToSeconds(clip.start);
                    const endSeconds = convertTimeToSeconds(clip.end);
                    totalDuration = endSeconds - startSeconds;
                    
                    // Validate single segment
                    if (startSeconds >= 0 && endSeconds <= videoDurationSeconds && 
                        startSeconds < endSeconds && totalDuration >= 30 && totalDuration <= 90) {
                        processedClip.start = startSeconds;
                        processedClip.end = endSeconds;
                        processedClip.totalDuration = totalDuration;
                        validatedClips.push(processedClip);
                    } else {
                        console.warn(`✗ Rejected single clip "${clip.title}": ${clip.start}-${clip.end} (duration: ${totalDuration}s, video: ${videoDurationSeconds}s)`);
                    }
                }
            } catch (error) {
                console.warn(`Error processing clip "${clip.title}":`, error);
            }
        }

        console.log(`Final result: ${validatedClips.length} valid clips out of ${suggestedClips.length} suggested`);
        
        transcriptDoc.clips = validatedClips;
        await Transcript.findByIdAndUpdate(transcriptDoc._id, transcriptDoc);

        res.json(transcriptDoc);

    } catch (err) {
        console.error(`Server error during analysis: ${err}`);
        res.status(500).json({ error: 'Failed to analyze transcript and generate clips.' });
    }
});

module.exports = router; 