const express = require('express');
const router = express.Router();

const uploadRoutes = require('./upload');
const analyzeRoutes = require('./analyze');
const transcriptsRoutes = require('./transcripts');
const clipsRoutes = require('./clips');
const fixStatusRoutes = require('./fix-status');

// Mount specific routes. Order matters for wildcard routes.
router.use('/upload', uploadRoutes); // Specific route for uploads
router.use('/transcripts', transcriptsRoutes); // Specific route for all transcripts and individual transcript by ID
router.use('/analyze', analyzeRoutes); // Specific route for analysis
router.use('/clips', clipsRoutes); // Specific route for clips (if any sub-routes are defined in clips.js)
router.use('/admin', fixStatusRoutes); // Admin routes for fixing data issues

module.exports = router; 