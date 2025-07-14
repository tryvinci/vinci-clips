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

        const prompt = `Given the following transcript, propose up to 5 video clips that are between 30 and 60 seconds long. For each clip, provide a suggested start time (MM:SS), end time (MM:SS), and a concise title. The output should be a JSON array of objects, where each object has 'start', 'end', and 'title' fields. If you cannot find suitable clips, return an empty array. Transcript: ${fullTranscriptText}`;

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
                            start: { type: 'STRING' },
                            end: { type: 'STRING' },
                            title: { type: 'STRING' },
                        },
                        required: ['start', 'end', 'title'],
                        propertyOrdering: ['start', 'end', 'title'],
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

        transcriptDoc.clips = suggestedClips;
        await transcriptDoc.save();

        res.json(transcriptDoc);

    } catch (err) {
        console.error(`Server error during analysis: ${err}`);
        res.status(500).json({ error: 'Failed to analyze transcript and generate clips.' });
    }
});

module.exports = router; 