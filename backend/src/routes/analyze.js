const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const Transcript = require('../models/Transcript');

router.post('/:transcriptId', async (req, res) => {
    try {
        const transcript = await Transcript.findById(req.params.transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found.' });
        }

        const pythonExecutable = path.resolve(__dirname, '..', '..', '..', 'scripts', 'venv', 'bin', 'python');
        const scriptPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'analysis', 'analyze.py');
        const analyzeCmd = `${pythonExecutable} ${scriptPath} "${transcript.transcript}"`;

        exec(analyzeCmd, { env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY, LLM_PROVIDER: process.env.LLM_PROVIDER, GROQ_API_KEY: process.env.GROQ_API_KEY, LLM_MODEL: process.env.LLM_MODEL } }, async (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                console.error(`stderr: ${stderr}`);
                return res.status(500).json({ error: 'Failed to analyze transcript.' });
            }

            try {
                const clips = JSON.parse(stdout);
                transcript.clips = clips;
                await transcript.save();
                res.json(transcript);
            } catch (e) {
                console.error('Failed to parse analysis result or save to DB.', e);
                res.status(500).json({ error: 'Failed to process analysis result.' });
            }
        });

    } catch (err) {
        console.error(`Server error: ${err}`);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});

module.exports = router; 