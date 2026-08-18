const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const eventController = require('../controllers/eventController');
const mediaController = require('../controllers/mediaController');
const messageController = require('../controllers/messageController');
const { requireAuth, requireEventOwnership } = require('../middleware/auth');

// All admin routes require authentication
router.use(requireAuth);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Events List & Creation
router.get('/events', eventController.listEvents);
router.get('/events/create', eventController.getCreateEvent);
router.post('/events/create', eventController.createEvent);

// Single Event Settings & Controls
router.get('/events/:publicId/edit', requireEventOwnership, eventController.getEditEvent);
router.post('/events/:publicId/edit', requireEventOwnership, eventController.updateEvent);
router.post('/events/:publicId/toggle-uploads', requireEventOwnership, eventController.toggleUploads);
router.post('/events/:publicId/delete', requireEventOwnership, eventController.deleteEvent);

// QR Code & Printable Table Card
router.get('/events/:publicId/qr', requireEventOwnership, eventController.getPrintCard);

// Manage Media & Moderation
router.get('/events/:publicId/manage', requireEventOwnership, adminController.getManageMedia);
router.get('/events/:publicId/download-all', requireEventOwnership, mediaController.downloadAllZip);

// Individual Deletion Actions
router.post('/media/:id/delete', mediaController.deleteMedia);
router.post('/messages/:id/delete', messageController.deleteMessage);

module.exports = router;
