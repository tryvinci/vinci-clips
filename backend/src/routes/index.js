const express = require('express');
const router = express.Router();

const uploadRoutes = require('./upload');
const analyzeRoutes = require('./analyze');
const transcriptsRoutes = require('./transcripts');
const clipsRoutes = require('./clips');

router.use('/', uploadRoutes);
router.use('/', analyzeRoutes);
router.use('/', transcriptsRoutes);
router.use('/', clipsRoutes);

module.exports = router; 