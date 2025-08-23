const express = require('express');
const { Storage } = require('@google-cloud/storage');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const uploadRoutes = require('./upload');
const analyzeRoutes = require('./analyze');
const transcriptsRoutes = require('./transcripts');
const clipsRoutes = require('./clips');
const captionsRoutes = require('./captions');
const fixStatusRoutes = require('./fix-status');
const importRoutes = require('./import');
const retryRoutes = require('./retry-transcription');
const reframeRoutes = require('./reframe');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_BUCKET_NAME || 'vinci-dev');

// Video proxy endpoint for CORS - This can remain public
router.get('/video-proxy/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Try clips folder first (for generated clips), then videos folder
        let file = bucket.file(`clips/${filename}`);
        
        // Check if file exists in clips folder
        try {
            const [exists] = await file.exists();
            if (!exists) {
                // File not in clips, try videos folder
                file = bucket.file(`videos/${filename}`);
            }
        } catch (err) {
            // If error checking clips, default to videos folder
            file = bucket.file(`videos/${filename}`);
        }
        
        // Set CORS headers
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'video/mp4',
            'Cache-Control': 'public, max-age=3600'
        });
        
        const stream = file.createReadStream();
        stream.pipe(res);
        
        stream.on('error', (err) => {
            console.error('Video proxy error:', err);
            res.status(404).json({ error: 'Video not found' });
        });
        
    } catch (error) {
        console.error('Video proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy video' });
    }
});

// Mount specific routes with authentication. Order matters for wildcard routes.
router.use('/upload', authenticate, uploadRoutes);
router.use('/import', authenticate, importRoutes);
router.use('/transcripts', authenticate, transcriptsRoutes);
router.use('/analyze', authenticate, analyzeRoutes);
router.use('/clips', authenticate, clipsRoutes);
router.use('/captions', authenticate, captionsRoutes);
router.use('/reframe', authenticate, reframeRoutes);
router.use('/retry', authenticate, retryRoutes);
router.use('/admin', authenticate, fixStatusRoutes);

module.exports = router; 