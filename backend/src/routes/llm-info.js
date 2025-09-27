const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');

// Get LLM provider information
router.get('/provider-info', async (req, res) => {
    try {
        const providerInfo = llmService.getProviderInfo();
        res.status(200).json({
            status: 'success',
            data: providerInfo
        });
    } catch (error) {
        console.error('Error getting provider info:', error);
        res.status(500).json({
            status: 'error',
            error: 'Failed to get LLM provider information'
        });
    }
});

module.exports = router;