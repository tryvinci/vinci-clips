const { Transcript, newTranscript } = require('../localdb');

// This file now acts as a pass-through to the localdb module.
// This keeps the model import paths consistent across the application.

// We need to export a constructor-like function for `new Transcript()` to work
const TranscriptModel = function(data) {
    return newTranscript(data);
};

// Attach the static methods
TranscriptModel.find = Transcript.find;
TranscriptModel.findById = Transcript.findById;
TranscriptModel.create = Transcript.create;
TranscriptModel.findByIdAndUpdate = Transcript.findByIdAndUpdate;
TranscriptModel.findByIdAndDelete = Transcript.findByIdAndDelete;

module.exports = TranscriptModel;