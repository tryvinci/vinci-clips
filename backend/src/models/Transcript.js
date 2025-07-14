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
        start: Number,
        end: Number,
        title: String,
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Transcript', TranscriptSchema); 