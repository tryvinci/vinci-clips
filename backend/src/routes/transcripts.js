const express = require('express');
const { ObjectId } = require('mongodb');
const connectDB = require('../db');

const router = express.Router();

// Get all transcripts
router.get('/transcripts', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('transcripts');
        const transcripts = await collection.find({}).sort({ createdAt: -1 }).toArray();
        res.status(200).json(transcripts);
    } catch (error) {
        res.status(500).send({ message: 'Failed to fetch transcripts: ' + error.message });
    }
});

// Get a single transcript by ID
router.get('/transcripts/:id', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('transcripts');
        const transcript = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!transcript) {
            return res.status(404).send('Transcript not found');
        }
        res.status(200).json(transcript);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router; 