const express = require('express');
const connectDB = require('../db');
const Transcript = require('../models/Transcript');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();

// Get all transcripts
router.get('/', async (req, res) => {
    try {
        const userId = req.auth.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: X-User-ID header is missing.' });
        }
        const transcripts = await Transcript.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json(transcripts);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch transcripts: ${error.message}` }); // Unified error format
    }
});

// Get a single transcript by ID
router.get('/:id', async (req, res) => {
    try {
        const userId = req.auth.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: X-User-ID header is missing.' });
        }
        const transcript = await Transcript.findOne({ _id: req.params.id, userId });
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found or unauthorized' }); // Clarified error
        }
        res.status(200).json(transcript);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch transcript: ${error.message}` });
    }
});

// Update transcript (for clearing clips)
router.put('/:id', async (req, res) => {
    try {
        const userId = req.auth.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: X-User-ID header is missing.' });
        }
        const { clips } = req.body;
        const transcript = await Transcript.findOneAndUpdate(
            { _id: req.params.id, userId }, // Added userId filter
            { clips },
            { new: true }
        );
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found or unauthorized' });
        }
        res.status(200).json(transcript);
    } catch (error) {
        res.status(500).json({ error: `Failed to update transcript: ${error.message}` });
    }
});

// Delete a transcript
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.auth.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: X-User-ID header is missing.' });
        }
        const transcript = await Transcript.findOne({ _id: req.params.id, userId }); // Added userId filter
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found or unauthorized' });
        }

        const storage = new Storage();
        const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');
        const deletePromises = [];

        // Delete video file
        if (transcript.videoCloudPath) {
            deletePromises.push(bucket.file(transcript.videoCloudPath).delete().catch(err => {
                console.warn(`Failed to delete video file: ${err.message}`);
            }));
        }

        // Delete MP3 file
        if (transcript.videoCloudPath) {
            const mp3Path = transcript.videoCloudPath.replace('videos/', 'audio/').replace('.mp4', '.mp3');
            deletePromises.push(bucket.file(mp3Path).delete().catch(err => {
                console.warn(`Failed to delete MP3 file: ${err.message}`);
            }));
        }

        // Delete thumbnail
        if (transcript.thumbnailUrl) {
            const thumbnailPath = transcript.videoCloudPath.replace('videos/', 'thumbnails/').replace('.mp4', '_thumbnail.jpg');
            deletePromises.push(bucket.file(thumbnailPath).delete().catch(err => {
                console.warn(`Failed to delete thumbnail file: ${err.message}`);
            }));
        }

        await Promise.all(deletePromises);

        // Delete the transcript from the database
        await Transcript.deleteOne({ _id: req.params.id, userId }); // Added userId filter for safety

        res.status(200).json({ message: 'Transcript and associated files deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: `Failed to delete transcript: ${error.message}` });
    }
});

module.exports = router;