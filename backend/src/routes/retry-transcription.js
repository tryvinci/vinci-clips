const express = require('express');
const Transcript = require('../models/Transcript');
const llmService = require('../services/llmService');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();

function resolveLocalUploadPath(urlPath) {
    if (!urlPath) return null;
    return path.join(__dirname, '..', '..', 'uploads', path.basename(urlPath));
}

// Retry transcription for a stuck transcript
router.post('/retry/:transcriptId', async (req, res) => {
    const { transcriptId } = req.params;

    try {
        if (!transcriptId) {
            return res.status(400).json({ error: 'Transcript ID is required.' });
        }

        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found.' });
        }

        if (!['transcribing', 'failed'].includes(transcript.status)) {
            return res.status(400).json({
                error: `Cannot retry transcript with status: ${transcript.status}`,
            });
        }

        if (!transcript.mp3Url) {
            return res.status(400).json({
                error: 'No MP3 URL found. Video processing may have failed.',
            });
        }

        const mp3Path = resolveLocalUploadPath(transcript.mp3Url);
        if (!mp3Path || !fs.existsSync(mp3Path)) {
            return res.status(404).json({ error: 'MP3 file not found on disk.' });
        }

        logger.logVideoProcessing(transcriptId, 'retrying', 'Starting transcription retry');

        transcript.status = 'transcribing';
        await transcript.save();

        const transcriptContent = await llmService.transcribeAudio(
            mp3Path,
            transcript.originalFilename.replace(/\.[^.]+$/, '.mp3')
        );

        transcript.transcript = transcriptContent;
        transcript.status = 'completed';
        await transcript.save();

        res.status(200).json({
            message: 'Transcription retry completed successfully',
            transcript,
            segmentCount: transcriptContent.length,
        });
    } catch (error) {
        console.error(`Transcription retry failed for ${transcriptId}:`, error);

        try {
            const transcript = await Transcript.findById(transcriptId);
            if (transcript) {
                transcript.status = 'failed';
                await transcript.save();
            }
        } catch (updateError) {
            console.error('Failed to update transcript status:', updateError);
        }

        res.status(500).json({
            error: 'Transcription retry failed',
            details: error.message,
        });
    }
});

module.exports = router;
