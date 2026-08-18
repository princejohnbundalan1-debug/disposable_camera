const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const mediaController = require('../controllers/mediaController');
const messageController = require('../controllers/messageController');
const upload = require('../middleware/upload');
const { uploadLimiter, messageLimiter } = require('../middleware/security');

// Guest Event Landing Page & Disposable Camera Viewfinder
router.get('/:publicId', eventController.getGuestEventPage);

// Shared Photo & Video Album
router.get('/:publicId/album', mediaController.getGuestAlbumPage);

// Guestbook & Wishes Page
router.get('/:publicId/guestbook', messageController.getGuestbookPage);

// Media Upload (Single or Multiple)
router.post('/:publicId/upload', uploadLimiter, upload.array('media', 10), mediaController.uploadMedia);

// Guestbook Message Submission
router.post('/:publicId/messages', messageLimiter, messageController.postMessage);

// Single Media Download
router.get('/download/:id', mediaController.downloadMedia);

module.exports = router;
