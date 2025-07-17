const express = require('express');
const connectDB = require('../db');
const Transcript = require('../models/Transcript');

const router = express.Router();

// Get all transcripts
router.get('/', async (req, res) => {
    try {
        const transcripts = await Transcript.find({}).sort({ createdAt: -1 });
        res.status(200).json(transcripts);
    } catch (error) {
        res.status(500).send({ message: 'Failed to fetch transcripts: ' + error.message });
    }
});

// Get a single transcript by ID
router.get('/:id', async (req, res) => {
    try {
        const transcript = await Transcript.findById(req.params.id);
        if (!transcript) {
            return res.status(404).send('Transcript not found');
        }
        res.status(200).json(transcript);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Update transcript (for clearing clips)
router.put('/:id', async (req, res) => {
    try {
        const { clips } = req.body;
        const transcript = await Transcript.findByIdAndUpdate(
            req.params.id,
            { clips: clips },
            { new: true }
        );
        if (!transcript) {
            return res.status(404).send('Transcript not found');
        }
        res.status(200).json(transcript);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router; 