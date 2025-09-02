const express = require('express');
const Transcript = require('../models/Transcript');
const path = require('path');

const router = express.Router();

// Get all transcripts
router.get('/', async (req, res) => {
    try {
        const transcripts = await Transcript.find({});
        res.status(200).json(transcripts);
    } catch (error) {
        res.status(500).send({ message: 'Failed to fetch transcripts: ' + error.message });
    }
});

const fs = require('fs');

// Get a single transcript by ID
router.get('/:id', async (req, res) => {
    try {
        const transcript = await Transcript.findById(req.params.id);
        if (!transcript) {
            return res.status(404).send('Transcript not found');
        }
        
        const transcriptObject = { ...transcript };

        if (transcriptObject.videoUrl) {
            transcriptObject.videoUrl = `/uploads/${path.basename(transcriptObject.videoUrl)}`;
        }

        // Check for existing generated clips
        const clipsDir = path.join(__dirname, '..', '..', 'uploads', 'clips');
        const existingClips = {};
        if (fs.existsSync(clipsDir) && transcriptObject.clips && transcriptObject.clips.length > 0) {
            transcriptObject.clips.forEach((clip, index) => {
                const clipFilename = `${transcript._id}_clip_${index}.mp4`;
                const clipPath = path.join(clipsDir, clipFilename);
                if (fs.existsSync(clipPath)) {
                    existingClips[index] = {
                        url: `/uploads/clips/${clipFilename}`,
                        title: clip.title
                    };
                }
            });
        }
        transcriptObject.generatedClips = existingClips;

        res.status(200).json(transcriptObject);
    } catch (error) {
        console.error('Error fetching transcript:', error);
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
        
        const transcript = await Transcript.findById(id);
        if (!transcript) {
            return res.status(404).json({ message: 'Transcript not found' });
        }

        const fs = require('fs');
        const path = require('path');

        // Delete local files
        if (transcript.videoUrl) {
            const videoPath = path.join(__dirname, '..', '..', 'storage', transcript.videoUrl);
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        }
        if (transcript.mp3Url) {
            const mp3Path = path.join(__dirname, '..', '..', 'storage', transcript.mp3Url);
            if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        }
        if (transcript.thumbnailUrl) {
            const thumbnailPath = path.join(__dirname, '..', '..', 'storage', transcript.thumbnailUrl);
            if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
        }
        
        // Delete the transcript from the database
        await Transcript.findByIdAndDelete(id);
        
        res.status(200).json({ message: 'Transcript and associated files deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: `Failed to delete transcript: ${error.message}` });
    }
});

module.exports = router; 