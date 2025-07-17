const express = require('express');
const Transcript = require('../models/Transcript');

const router = express.Router();

// Fix transcript statuses that are stuck in processing
router.post('/fix-statuses', async (req, res) => {
    try {
        // Find all transcripts that have transcript data but are stuck in uploading status
        const transcriptsToFix = await Transcript.find({
            status: { $in: ['uploading', 'converting', 'transcribing'] },
            transcript: { $exists: true, $not: { $size: 0 } },
            videoUrl: { $exists: true, $ne: '' },
            mp3Url: { $exists: true, $ne: '' }
        });

        console.log(`Found ${transcriptsToFix.length} transcripts to fix`);

        // Update them to completed status
        const result = await Transcript.updateMany(
            {
                status: { $in: ['uploading', 'converting', 'transcribing'] },
                transcript: { $exists: true, $not: { $size: 0 } },
                videoUrl: { $exists: true, $ne: '' },
                mp3Url: { $exists: true, $ne: '' }
            },
            { $set: { status: 'completed' } }
        );

        // Also fix any records that don't have status at all but are complete
        const resultNoStatus = await Transcript.updateMany(
            {
                status: { $exists: false },
                transcript: { $exists: true, $not: { $size: 0 } },
                videoUrl: { $exists: true, $ne: '' }
            },
            { $set: { status: 'completed' } }
        );

        const totalFixed = result.modifiedCount + resultNoStatus.modifiedCount;
        
        res.status(200).json({
            message: 'Status fix completed successfully',
            fixedWithStatus: result.modifiedCount,
            fixedWithoutStatus: resultNoStatus.modifiedCount,
            totalFixed: totalFixed
        });

    } catch (error) {
        console.error('Error fixing transcript statuses:', error);
        res.status(500).json({ error: 'Failed to fix transcript statuses' });
    }
});

module.exports = router;