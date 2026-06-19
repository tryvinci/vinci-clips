const express = require('express');
const Transcript = require('../models/Transcript');

const router = express.Router();

function isComplete(transcript) {
    return (
        Array.isArray(transcript.transcript) &&
        transcript.transcript.length > 0 &&
        transcript.videoUrl &&
        transcript.mp3Url
    );
}

// Fix transcript statuses that are stuck in processing
router.post('/fix-statuses', async (req, res) => {
    try {
        const transcripts = await Transcript.find({});
        let fixedWithStatus = 0;
        let fixedWithoutStatus = 0;

        for (const transcript of transcripts) {
            if (!isComplete(transcript)) continue;

            if (['uploading', 'converting', 'transcribing'].includes(transcript.status)) {
                await Transcript.findByIdAndUpdate(transcript._id, { status: 'completed' });
                fixedWithStatus++;
            } else if (!transcript.status) {
                await Transcript.findByIdAndUpdate(transcript._id, { status: 'completed' });
                fixedWithoutStatus++;
            }
        }

        res.status(200).json({
            message: 'Status fix completed successfully',
            fixedWithStatus,
            fixedWithoutStatus,
            totalFixed: fixedWithStatus + fixedWithoutStatus,
        });
    } catch (error) {
        console.error('Error fixing transcript statuses:', error);
        res.status(500).json({ error: 'Failed to fix transcript statuses' });
    }
});

module.exports = router;
