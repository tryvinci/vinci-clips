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
        required: false,
        default: '',
    },
    videoCloudPath: {
        type: String, // Store the actual cloud storage path for video processing
        required: false,
    },
    mp3Url: {
        type: String,
        required: false,
        default: '',
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
    status: {
        type: String,
        enum: ['uploading', 'converting', 'transcribing', 'completed', 'failed'],
        default: 'uploading',
        required: true,
    },
    thumbnailUrl: {
        type: String, // URL to video thumbnail
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Transcript', TranscriptSchema); 