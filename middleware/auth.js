const { query } = require('../config/db');

/**
 * Ensures the user is logged into an active organizer session.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  
  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  req.flash('error', 'Please log in to access this page.');
  return res.redirect('/auth/login');
}

/**
 * Ensures logged in user owns the requested event (or is an admin)
 */
async function requireEventOwnership(req, res, next) {
  const eventIdentifier = req.params.publicId || req.params.eventId || req.body.eventId;
  
  if (!eventIdentifier) {
    return res.status(400).render('partials/error', {
      title: 'Bad Request',
      message: 'Event identifier is missing.'
    });
  }

  try {
    const isNumeric = /^\d+$/.test(eventIdentifier);
    const sql = isNumeric 
      ? 'SELECT * FROM events WHERE id = ?' 
      : 'SELECT * FROM events WHERE public_id = ?';
    
    const [rows] = await query(sql, [eventIdentifier]);
    
    if (!rows || rows.length === 0) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      return res.status(404).render('partials/error', {
        title: 'Event Not Found',
        message: 'The requested event could not be found.'
      });
    }

    const event = rows[0];

    // Verify ownership (allow demo-wedding for logged in organizers)
    if (event.organizer_id !== req.session.user.id && req.session.user.role !== 'admin' && event.public_id !== 'demo-wedding') {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to event' });
      }
      return res.status(403).render('partials/error', {
        title: 'Access Denied',
        message: 'You do not have permission to manage this event.'
      });
    }

    req.event = event;
    return next();
  } catch (error) {
    console.error('[AuthMiddleware] Error checking event ownership:', error);
    return next(error);
  }
}

/**
 * Helper to pass session user to all views
 */
function attachUserToLocals(req, res, next) {
  res.locals.user = req.session ? req.session.user : null;
  res.locals.isAuthenticated = !!(req.session && req.session.user);
  res.locals.appName = process.env.APP_NAME || 'Wedding Moments';
  res.locals.currentPath = req.path;
  next();
}

module.exports = {
  requireAuth,
  requireEventOwnership,
  attachUserToLocals
};
