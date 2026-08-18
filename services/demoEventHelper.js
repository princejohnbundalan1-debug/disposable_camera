const { query } = require('../config/db');

/**
 * Ensures the Demo Wedding Event exists in the database.
 * Auto-creates it on first access if not present.
 */
async function ensureDemoEvent() {
  try {
    const [rows] = await query('SELECT * FROM events WHERE public_id = ?', ['demo-wedding']);
    if (rows && rows.length > 0) {
      return rows[0];
    }

    // Find or create demo organizer
    let organizerId = null;
    try {
      const [users] = await query('SELECT id FROM users LIMIT 1');
      if (users && users.length > 0) {
        organizerId = users[0].id;
      } else {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('WeddingDemo2026!', 10);
        const [userResult] = await query(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          ['Demo Organizer', 'demo@weddingmoments.app', hash, 'organizer']
        );
        organizerId = userResult.insertId;
      }
    } catch (uErr) {
      console.warn('[DemoEventHelper] User creation notice:', uErr.message);
      organizerId = 1;
    }

    await query(`
      INSERT INTO events 
      (public_id, organizer_id, name, couple_names, description, event_date, theme_color, is_uploads_enabled, privacy_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PUBLIC')
    `, [
      'demo-wedding',
      organizerId,
      'Hannah & Juan Wedding',
      'Hannah & Juan',
      'Welcome to our digital disposable wedding camera! Snap candid photos, short video clips, and leave us a heartfelt wish.',
      '2026-09-01',
      '#C5A880'
    ]);

    const [created] = await query('SELECT * FROM events WHERE public_id = ?', ['demo-wedding']);
    if (created && created.length > 0) {
      try {
        await query(`
          INSERT INTO messages (event_id, guest_name, message, status)
          VALUES (?, ?, ?, 'visible')
        `, [
          created[0].id,
          'Maid of Honor (Elena)',
          'Wishing Hannah & Juan a lifetime of laughter, joy, and unforgettable adventures! Cheers! 🥂✨'
        ]);
      } catch (mErr) {}
      return created[0];
    }
    return null;
  } catch (err) {
    console.error('[DemoEventHelper] Error ensuring demo event:', err.message);
    return null;
  }
}

module.exports = { ensureDemoEvent };
