const { app, startServer } = require('../server');

let isDbInitialized = false;

module.exports = async (req, res) => {
  if (!isDbInitialized) {
    try {
      const { initDatabase } = require('../config/db');
      await initDatabase();
      isDbInitialized = true;
    } catch (e) {
      console.warn('[Vercel Lambda] Database warm-up notice:', e.message);
    }
  }
  return app(req, res);
};
