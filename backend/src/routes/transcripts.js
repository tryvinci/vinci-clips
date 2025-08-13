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

// Delete a transcript
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the transcript to get cloud storage paths
        const transcript = await Transcript.findById(id);
        if (!transcript) {
            return res.status(404).json({ message: 'Transcript not found' });
        }
        
        // Delete files from cloud storage if they exist
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage();
        const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');
        
        const deletePromises = [];
        
        // Delete video file
        if (transcript.videoCloudPath) {
            deletePromises.push(bucket.file(transcript.videoCloudPath).delete().catch(err => {
                console.warn(`Failed to delete video file: ${err.message}`);
            }));
        }
        
        // Delete MP3 file (derive path from videoCloudPath)
        if (transcript.videoCloudPath) {
            const mp3Path = transcript.videoCloudPath.replace('videos/', 'audio/').replace('.mp4', '.mp3');
            deletePromises.push(bucket.file(mp3Path).delete().catch(err => {
                console.warn(`Failed to delete MP3 file: ${err.message}`);
            }));
        }
        
        // Delete thumbnail if it exists
        if (transcript.thumbnailUrl) {
            const thumbnailPath = transcript.videoCloudPath.replace('videos/', 'thumbnails/').replace('.mp4', '_thumbnail.jpg');
            deletePromises.push(bucket.file(thumbnailPath).delete().catch(err => {
                console.warn(`Failed to delete thumbnail file: ${err.message}`);
            }));
        }
        
        // Wait for all cloud storage deletions to complete
        await Promise.all(deletePromises);
        
        // Delete the transcript from the database
        await Transcript.findByIdAndDelete(id);
        
        res.status(200).json({ message: 'Transcript and associated files deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: `Failed to delete transcript: ${error.message}` });
    }
});

module.exports = router; 