const express = require('express');
const { ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const connectDB = require('../db');

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze', async (req, res) => {
    const { transcriptId } = req.body;

    if (!transcriptId) {
        return res.status(400).send('Transcript ID is required.');
    }

    try {
        const db = await connectDB();
        const transcriptsCollection = db.collection('transcripts');
        const clipsCollection = db.collection('clips');

        const transcriptDoc = await transcriptsCollection.findOne({ _id: new ObjectId(transcriptId) });

        if (!transcriptDoc) {
            return res.status(404).send('Transcript not found.');
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Based on the following transcript, identify 3-5 engaging segments that would make good short video clips. For each segment, provide the exact start and end time in seconds.

Transcript:
"${JSON.stringify(transcriptDoc.transcription)}"

Return the result as a JSON array of objects, where each object has "start", "end", and "title" properties. For example: [{"start": 10.5, "end": 25.2, "title": "The Big Reveal"}, ...].`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean the response from the LLM
        const cleanedJsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const clips = JSON.parse(cleanedJsonString);

        const clipsDocument = {
            transcriptId: new ObjectId(transcriptId),
            clips,
            createdAt: new Date(),
        };

        await clipsCollection.insertOne(clipsDocument);

        res.status(200).json(clipsDocument);
    } catch (error) {
        console.error('Error analyzing transcript:', error);
        res.status(500).send('Failed to analyze transcript.');
    }
});

module.exports = router; 