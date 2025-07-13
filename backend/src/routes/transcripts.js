const express = require('express');
const { ObjectId } = require('mongodb');
const connectDB = require('../db');

const router = express.Router();

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