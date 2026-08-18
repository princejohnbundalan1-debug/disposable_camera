const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
require('dotenv').config();

const { initDatabase } = require('./config/db');
const { helmetConfig } = require('./middleware/security');
const { attachUserToLocals } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const guestRoutes = require('./routes/guestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Logging
app.use(helmetConfig);
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static asset folders
app.use(express.static(path.join(__dirname, 'public')));

// Storage files (photos & thumbnails) with robust fallback
app.use('/storage-files', express.static(path.join(__dirname, 'storage')));
app.get('/storage-files/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(__dirname, 'storage', folder, safeFilename);
  const fs = require('fs');

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Graceful fallback SVG for images reset across ephemeral server restarts
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <rect width="400" height="400" fill="#1C221E" rx="16"/>
      <circle cx="200" cy="170" r="55" fill="#C5A880" opacity="0.15"/>
      <text x="200" y="185" font-size="44" text-anchor="middle" fill="#C5A880">💍</text>
      <text x="200" y="255" font-size="16" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#F4EDE2">Wedding Moment</text>
      <text x="200" y="280" font-size="12" font-family="sans-serif" text-anchor="middle" fill="#8E9791">Captured by Wedding Guest</text>
    </svg>
  `);
});

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'wedding_disposable_camera_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  })
);

// Flash messages
app.use(flash());

// Context locals (available across all views)
app.use(attachUserToLocals);
app.use((req, res, next) => {
  res.locals.flashSuccess = req.flash('success');
  res.locals.flashError = req.flash('error');
  next();
});

// Route registration
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/e', guestRoutes);
app.use('/event', guestRoutes); // Alias for convenience
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// 404 and Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server after ensuring database connection and tables
async function startServer() {
  try {
    console.log('[Server] Initializing MySQL Database & Schema...');
    await initDatabase();
    console.log('[Server] Database initialized.');
  } catch (dbError) {
    console.warn('[Server] Notice: Database connection error on startup:', dbError.message);
    console.warn('[Server] Starting web server anyway to allow UI browsing, diagnostics, and recovery.');
  }

  const server = app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`💍 ${process.env.APP_NAME || 'Wedding Moments - Digital Disposable Camera'}`);
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log(`📷 Guest Event Path:  http://localhost:${PORT}/e/:publicId`);
    console.log(`👑 Organizer Portal:  http://localhost:${PORT}/auth/login`);
    console.log(`========================================================\n`);
  });

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };
