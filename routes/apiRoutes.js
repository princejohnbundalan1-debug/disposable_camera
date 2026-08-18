const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const messageController = require('../controllers/messageController');
const upload = require('../middleware/upload');
const { uploadLimiter, messageLimiter } = require('../middleware/security');

// Media REST Endpoints
router.get('/events/:publicId/media', mediaController.getMediaApi);
router.post('/events/:publicId/media', uploadLimiter, upload.array('media', 10), mediaController.uploadMedia);

// Messages REST Endpoints
router.post('/events/:publicId/messages', messageLimiter, messageController.postMessage);

// Cloudinary Diagnostics & Verification Endpoint
router.get('/cloudinary-test', async (req, res) => {
  try {
    const CloudinaryStorageProvider = require('../storage/providers/cloudinaryStorageProvider');
    const provider = new CloudinaryStorageProvider();
    const testResult = await provider.testConnection();
    res.json({
      status: testResult.success ? 'connected' : 'error',
      provider: provider.getName(),
      result: testResult
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
