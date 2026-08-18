const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { runMigrations } = require('../database/migrations');
require('dotenv').config();

let pool = null;
let sqliteDb = null;
let isSqliteMode = false;

/**
 * Initializes database connection.
 * Primary: MySQL 8.0+
 * Fallback: Embedded SQLite3 file database if MySQL is not currently running.
 */
async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'wedding_disposable_camera';
  const useSsl = process.env.DB_SSL === 'true' || (databaseUrl && databaseUrl.includes('ssl='));

  try {
    // Attempt MySQL connection and migrations
    await runMigrations();

    const poolConfig = databaseUrl
      ? {
          uri: databaseUrl,
          waitForConnections: true,
          connectionLimit: 10,
          ssl: useSsl ? { rejectUnauthorized: false } : undefined
        }
      : {
          host,
          port,
          user,
          password,
          database,
          waitForConnections: true,
          connectionLimit: 10,
          ssl: useSsl ? { rejectUnauthorized: false } : undefined
        };

    pool = mysql.createPool(poolConfig);

    const conn = await pool.getConnection();
    console.log(`[Database] MySQL Connection Pool successfully established.`);
    conn.release();
    isSqliteMode = false;
    return pool;
  } catch (mysqlError) {
    console.warn(`\n[Database Notice] MySQL is unreachable (${mysqlError.code || mysqlError.message}).`);
    console.warn(`[Database Notice] Gracefully activating Embedded Local SQLite Database for zero-friction development & testing.`);
    
    return await initSqliteFallback();
  }
}

/**
 * Initialize SQLite Fallback with identical tables
 */
async function initSqliteFallback() {
  let sqlite3Module;
  try {
    sqlite3Module = require('sqlite3').verbose();
  } catch (e) {
    console.error('[Database] SQLite3 is not installed in this environment and MySQL connection failed.');
    throw new Error('Database connection failed. Please provide a valid DATABASE_URL or MySQL connection.');
  }

  const storageDir = path.resolve(__dirname, '../storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const dbPath = path.join(storageDir, 'database.sqlite');
  isSqliteMode = true;

  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3Module.Database(dbPath, (err) => {
      if (err) {
        console.error('[Database SQLite] Error opening SQLite database:', err);
        return reject(err);
      }

      // Enable Foreign Keys in SQLite
      sqliteDb.run('PRAGMA foreign_keys = ON;', () => {
        // Create Tables
        sqliteDb.serialize(() => {
          // 1. Users
          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'organizer',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // 2. Events
          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              public_id TEXT NOT NULL UNIQUE,
              organizer_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              couple_names TEXT,
              description TEXT,
              event_date DATE,
              cover_image TEXT,
              theme_color TEXT DEFAULT '#C5A880',
              is_uploads_enabled INTEGER NOT NULL DEFAULT 1,
              privacy_mode TEXT NOT NULL DEFAULT 'PUBLIC',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);

          // 3. Media
          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS media (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_id INTEGER NOT NULL,
              media_type TEXT NOT NULL DEFAULT 'photo',
              original_filename TEXT NOT NULL,
              stored_filename TEXT NOT NULL UNIQUE,
              storage_path TEXT NOT NULL,
              thumbnail_path TEXT,
              mime_type TEXT NOT NULL,
              file_size INTEGER NOT NULL,
              width INTEGER,
              height INTEGER,
              duration INTEGER,
              uploader_name TEXT DEFAULT 'Anonymous Guest',
              caption TEXT,
              status TEXT NOT NULL DEFAULT 'active',
              uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            );
          `);

          // 4. Messages
          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_id INTEGER NOT NULL,
              guest_name TEXT NOT NULL DEFAULT 'Anonymous Guest',
              message TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'visible',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            );
          `, (tableErr) => {
            if (tableErr) {
              console.error('[Database SQLite] Error creating tables:', tableErr);
              return reject(tableErr);
            }
            console.log(`[Database SQLite] Embedded database initialized at ${dbPath}`);
            resolve(sqliteDb);
          });
        });
      });
    });
  });
}

/**
 * Execute parameterized query
 * Returns standard [rows, fields] format compatible with mysql2
 */
async function query(sql, params = []) {
  if (isSqliteMode) {
    return new Promise((resolve, reject) => {
      const trimmed = sql.trim();
      const isSelect = trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('PRAGMA');

      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve([rows || [], null]);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, null]);
        });
      }
    });
  }

  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDatabase() first.');
  }
  return await pool.query(sql, params);
}

/**
 * Execute parameterized statement
 */
async function execute(sql, params = []) {
  return await query(sql, params);
}

module.exports = {
  initDatabase,
  query,
  execute,
  isSqlite: () => isSqliteMode
};
