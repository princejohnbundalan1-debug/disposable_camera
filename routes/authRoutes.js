const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/security');

// Login
router.get('/login', authController.getLogin);
router.post('/login', authLimiter, authController.login);

// Register
router.get('/register', authController.getRegister);
router.post('/register', authLimiter, authController.register);

// Logout
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
