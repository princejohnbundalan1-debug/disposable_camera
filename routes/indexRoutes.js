const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

/**
 * Landing Page - Luxury Wedding Moments Digital Disposable Camera
 */
router.get('/', async (req, res) => {
  try {
    // Fetch a public demo event if available or render clean landing page
    const [sampleEvents] = await query(
      `SELECT name, couple_names, public_id, cover_image, theme_color 
       FROM events 
       WHERE privacy_mode = 'PUBLIC' 
       ORDER BY created_at DESC 
       LIMIT 3`
    ).catch(() => [[]]);

    res.render('index', {
      title: 'Digital Disposable Camera & Wedding Photo Album',
      sampleEvents: sampleEvents || [],
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    res.render('index', {
      title: 'Digital Disposable Camera & Wedding Photo Album',
      sampleEvents: [],
      error: [],
      success: []
    });
  }
});

module.exports = router;
