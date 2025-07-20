const express = require('express');
const { Storage } = require('@google-cloud/storage');
const router = express.Router();

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

// Video proxy endpoint for CORS
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

// Mount specific routes. Order matters for wildcard routes.
router.use('/upload', uploadRoutes); // Specific route for uploads
router.use('/import', importRoutes); // Specific route for URL imports
router.use('/transcripts', transcriptsRoutes); // Specific route for all transcripts and individual transcript by ID
router.use('/analyze', analyzeRoutes); // Specific route for analysis
router.use('/clips', clipsRoutes); // Specific route for clips (if any sub-routes are defined in clips.js)
router.use('/captions', captionsRoutes); // TikTok/Reels style caption generation
router.use('/reframe', reframeRoutes); // AI-powered video reframing for social media
router.use('/retry', retryRoutes); // Retry failed operations
router.use('/admin', fixStatusRoutes); // Admin routes for fixing data issues

module.exports = router; 