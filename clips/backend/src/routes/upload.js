const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const path = require('path');
const connectDB = require('../db');

const router = express.Router();

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB
  },
});

// Configure Google Cloud Storage
// The client automatically authenticates using the GOOGLE_APPLICATION_CREDENTIALS
// environment variable.
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME);

router.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const blob = bucket.file(Date.now() + '-' + req.file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on('error', (err) => {
    res.status(500).send({ message: err.message });
  });

  blobStream.on('finish', async () => {
    const gcsUri = `gs://${bucket.name}/${blob.name}`;
    
    // Determine the python command and script path
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'transcription', 'transcribe.py');

    // Trigger transcription script
    exec(`${pythonCmd} ${scriptPath} ${gcsUri}`, async (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            console.error(`stderr: ${stderr}`);
            return res.status(500).send({ message: 'Failed to transcribe video.' });
        }
        
        try {
            const transcription = JSON.parse(stdout);
            const db = await connectDB();
            const collection = db.collection('transcripts');
            
            const result = await collection.insertOne({
                gcsUri,
                transcription,
                createdAt: new Date(),
            });
            console.log('Transcription saved to MongoDB.');

            res.status(200).send({
              message: 'Upload successful, transcription complete.',
              transcriptId: result.insertedId,
              url: `https://storage.googleapis.com/${bucket.name}/${blob.name}`,
            });

        } catch (e) {
            console.error('Failed to parse transcription or save to MongoDB:', e);
            res.status(500).send({ message: 'Failed to process transcription.' });
        }
    });
  });

  blobStream.end(req.file.buffer);
});

module.exports = router; 