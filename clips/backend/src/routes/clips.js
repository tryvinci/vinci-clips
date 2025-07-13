const express = require('express');
const { ObjectId } = require('mongodb');
const connectDB = require('../db');

const router = express.Router();

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

module.exports = router; 