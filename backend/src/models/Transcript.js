const mongoose = require('mongoose');

const TranscriptSchema = new mongoose.Schema({
    originalFilename: {
        type: String,
        required: true,
    },
    transcript: [
        {
            start: { type: String, required: true },
            end: { type: String, required: true },
            text: { type: String, required: true },
            speaker: { type: String, required: false }, // Added speaker field
        },
    ],
    videoUrl: {
        type: String,
        required: true,
    },
    mp3Url: {
        type: String,
        required: true,
    },
    clips: [{
        title: String,
        start: Number, // For single segment clips
        end: Number,   // For single segment clips
        segments: [{   // For multi-segment clips
            start: Number,
            end: Number,
        }],
        totalDuration: Number, // Total duration in seconds
    }],
    duration: {
        type: Number, // Duration in seconds
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Transcript', TranscriptSchema); 