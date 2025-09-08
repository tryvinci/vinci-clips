const express = require('express');
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
const streamerRoutes = require('./streamer');


// Mount specific routes. Order matters for wildcard routes.
router.use('/upload', uploadRoutes); // Specific route for uploads
router.use('/import', importRoutes); // Specific route for URL imports
router.use('/transcripts', transcriptsRoutes); // Specific route for all transcripts and individual transcript by ID
router.use('/analyze', analyzeRoutes); // Specific route for analysis
router.use('/clips', clipsRoutes); // Specific route for clips (if any sub-routes are defined in clips.js)
router.use('/captions', captionsRoutes); // TikTok/Reels style caption generation
router.use('/reframe', reframeRoutes); // AI-powered video reframing for social media
router.use('/streamer', streamerRoutes); // Streamer & gameplay video processing
router.use('/retry', retryRoutes); // Retry failed operations
router.use('/admin', fixStatusRoutes); // Admin routes for fixing data issues

module.exports = router; 