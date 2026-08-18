const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Initializes the MySQL database and ensures all required tables exist.
 */
async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT, 10) || 3306;
  let user = process.env.DB_USER || 'root';
  let password = process.env.DB_PASSWORD || '';
  let database = process.env.DB_NAME || 'wedding_disposable_camera';

  if (databaseUrl && databaseUrl.startsWith('mysql')) {
    try {
      const cleanUrl = databaseUrl.split('?')[0];
      const parsed = new URL(cleanUrl);
      host = parsed.hostname;
      port = parseInt(parsed.port, 10) || 4000;
      user = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
      database = parsed.pathname.replace(/^\//, '') || 'test';
    } catch (e) {
      console.warn('[Database Migration] URL parse note:', e.message);
    }
  }

  const isCloudHost = host.includes('tidbcloud.com') || host.includes('aivencloud.com') || host.includes('rds.amazonaws.com');
  const useSsl = process.env.DB_SSL === 'true' || isCloudHost || (databaseUrl && databaseUrl.includes('ssl='));

  console.log(`[Database Migration] Initializing tables for MySQL database on ${host}:${port} (${database})...`);

  const connectionConfig = {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined
  };

  let dbConn;
  try {
    dbConn = await mysql.createConnection(connectionConfig);
  } catch (err) {
    // If connecting directly failed because the DB doesn't exist yet, try creating it (local MySQL)
    if (!isCloudHost && !databaseUrl && (err.code === 'ER_BAD_DB_ERROR' || err.errno === 1049)) {
      let serverConn;
      try {
        serverConn = await mysql.createConnection({ host, port, user, password });
        await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await serverConn.end();
        dbConn = await mysql.createConnection(connectionConfig);
      } catch (createErr) {
        throw createErr;
      }
    } else {
      throw err;
    }
  }

  try {
    // 1. Users Table
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'organizer',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Events Table
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        public_id VARCHAR(64) NOT NULL UNIQUE,
        organizer_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        couple_names VARCHAR(150) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        event_date DATE DEFAULT NULL,
        cover_image VARCHAR(255) DEFAULT NULL,
        theme_color VARCHAR(20) DEFAULT '#C5A880',
        is_uploads_enabled TINYINT(1) NOT NULL DEFAULT 1,
        privacy_mode ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_events_public_id (public_id),
        INDEX idx_events_organizer (organizer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Media Table
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS media (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        media_type ENUM('photo', 'video') NOT NULL DEFAULT 'photo',
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL UNIQUE,
        storage_path VARCHAR(500) NOT NULL,
        thumbnail_path VARCHAR(500) DEFAULT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL,
        width INT DEFAULT NULL,
        height INT DEFAULT NULL,
        duration INT DEFAULT NULL,
        uploader_name VARCHAR(100) DEFAULT 'Anonymous Guest',
        caption VARCHAR(255) DEFAULT NULL,
        status ENUM('active', 'hidden', 'deleted') NOT NULL DEFAULT 'active',
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        INDEX idx_media_event_status (event_id, status),
        INDEX idx_media_uploaded_at (uploaded_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Messages Table
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        guest_name VARCHAR(100) NOT NULL DEFAULT 'Anonymous Guest',
        message TEXT NOT NULL,
        status ENUM('visible', 'hidden', 'flagged') NOT NULL DEFAULT 'visible',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        INDEX idx_messages_event_status (event_id, status),
        INDEX idx_messages_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Seed default Demo Event if no events exist yet
    const [existingEvents] = await dbConn.query('SELECT id FROM events WHERE public_id = ? LIMIT 1', ['demo-wedding']);
    if (existingEvents.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('WeddingDemo2026!', 10);
      
      const [userResult] = await dbConn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
        ['Demo Organizer', 'demo@weddingmoments.app', hash, 'organizer']
      );
      
      const organizerId = userResult.insertId || 1;
      
      await dbConn.query(`
        INSERT IGNORE INTO events 
        (public_id, organizer_id, name, couple_names, description, event_date, theme_color, is_uploads_enabled, privacy_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'demo-wedding',
        organizerId,
        'Hannah & Juan Wedding',
        'Hannah & Juan',
        'Welcome to our digital disposable wedding camera! Snap candid photos, short video clips, and leave us a message.',
        '2026-09-01',
        '#C5A880',
        1,
        'PUBLIC'
      ]);

      // Seed a friendly sample guest message
      const [demoEvent] = await dbConn.query('SELECT id FROM events WHERE public_id = ? LIMIT 1', ['demo-wedding']);
      if (demoEvent.length > 0) {
        await dbConn.query(`
          INSERT INTO messages (event_id, guest_name, message, status)
          VALUES (?, ?, ?, ?)
        `, [
          demoEvent[0].id,
          'Maid of Honor (Elena)',
          'Wishing Hannah & Juan a lifetime of laughter, joy, and unforgettable adventures! Cheers to the beautiful couple! 🥂✨',
          'visible'
        ]);
      }
      console.log('[Database Migration] Demo wedding event ("demo-wedding") auto-seeded.');
    }

    console.log('[Database Migration] All tables (users, events, media, messages) verified & migrated successfully.');
  } finally {
    if (dbConn) await dbConn.end();
  }
}

module.exports = { runMigrations };
