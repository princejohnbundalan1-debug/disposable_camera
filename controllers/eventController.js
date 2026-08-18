const crypto = require('crypto');
const { query } = require('../config/db');
const qrService = require('../services/qrService');
const { THEMES } = require('../config/constants');

/**
 * Generates an elegant, non-sequential cryptographic public ID for the wedding event
 * Example: WED-2026-8F2K7A
 */
function generatePublicId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing 0, 1, I, O
  let randomStr = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    randomStr += chars[randomBytes[i] % chars.length];
  }
  const year = new Date().getFullYear();
  return `WED-${year}-${randomStr}`;
}

class EventController {
  /**
   * List all events for logged-in organizer
   */
  async listEvents(req, res) {
    try {
      const [events] = await query(
        `SELECT e.*, 
          (SELECT COUNT(*) FROM media WHERE event_id = e.id AND status = 'active') as media_count,
          (SELECT COUNT(*) FROM messages WHERE event_id = e.id AND status = 'visible') as messages_count
         FROM events e 
         WHERE e.organizer_id = ? OR e.public_id = 'demo-wedding'
         ORDER BY e.created_at DESC`,
        [req.session.user.id]
      );

      res.render('admin/events/index', {
        title: 'My Wedding Events | Organizer Suite',
        events,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('[EventController] List error:', error);
      req.flash('error', 'Could not load events.');
      res.redirect('/admin/dashboard');
    }
  }

  /**
   * Render Event Creation Page
   */
  getCreateEvent(req, res) {
    res.render('admin/events/create', {
      title: 'Create Wedding Event | Wedding Moments',
      themes: THEMES,
      error: req.flash('error'),
      success: req.flash('success')
    });
  }

  /**
   * Handle Event Creation
   */
  async createEvent(req, res) {
    const { name, couple_names, description, event_date, theme_color, privacy_mode } = req.body;

    if (!name) {
      req.flash('error', 'Please provide an event name.');
      return res.redirect('/admin/events/create');
    }

    try {
      let publicId = generatePublicId();
      // Ensure uniqueness
      let [existing] = await query('SELECT id FROM events WHERE public_id = ?', [publicId]);
      while (existing && existing.length > 0) {
        publicId = generatePublicId();
        [existing] = await query('SELECT id FROM events WHERE public_id = ?', [publicId]);
      }

      const selectedTheme = theme_color || '#C5A880';
      const privacy = privacy_mode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';

      const [result] = await query(
        `INSERT INTO events (
          public_id, organizer_id, name, couple_names, description, event_date, 
          theme_color, is_uploads_enabled, privacy_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          publicId,
          req.session.user.id,
          name.trim(),
          couple_names ? couple_names.trim() : null,
          description ? description.trim() : null,
          event_date || null,
          selectedTheme,
          privacy
        ]
      );

      req.flash('success', `Wedding event "${name}" created successfully! QR code is ready.`);
      return res.redirect(`/admin/events/${publicId}/qr`);
    } catch (error) {
      console.error('[EventController] Create error:', error);
      req.flash('error', 'Failed to create event. Please try again.');
      return res.redirect('/admin/events/create');
    }
  }

  /**
   * Render Event Edit Form
   */
  async getEditEvent(req, res) {
    const event = req.event;
    res.render('admin/events/edit', {
      title: `Edit ${event.name} | Event Settings`,
      event,
      themes: THEMES,
      error: req.flash('error'),
      success: req.flash('success')
    });
  }

  /**
   * Handle Event Update
   */
  async updateEvent(req, res) {
    const event = req.event;
    const { name, couple_names, description, event_date, theme_color, is_uploads_enabled, privacy_mode } = req.body;

    if (!name) {
      req.flash('error', 'Event name is required.');
      return res.redirect(`/admin/events/${event.public_id}/edit`);
    }

    try {
      await query(
        `UPDATE events SET 
          name = ?, couple_names = ?, description = ?, event_date = ?, 
          theme_color = ?, is_uploads_enabled = ?, privacy_mode = ?
         WHERE id = ?`,
        [
          name.trim(),
          couple_names ? couple_names.trim() : null,
          description ? description.trim() : null,
          event_date || null,
          theme_color || '#C5A880',
          is_uploads_enabled === 'on' || is_uploads_enabled === '1' || is_uploads_enabled === true ? 1 : 0,
          privacy_mode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
          event.id
        ]
      );

      req.flash('success', 'Event settings updated successfully.');
      return res.redirect(`/admin/events/${event.public_id}/edit`);
    } catch (error) {
      console.error('[EventController] Update error:', error);
      req.flash('error', 'Failed to update event.');
      return res.redirect(`/admin/events/${event.public_id}/edit`);
    }
  }

  /**
   * Toggle Guest Uploads (Killswitch)
   */
  async toggleUploads(req, res) {
    const event = req.event;
    const newState = event.is_uploads_enabled ? 0 : 1;

    try {
      await query('UPDATE events SET is_uploads_enabled = ? WHERE id = ?', [newState, event.id]);
      
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.json({ success: true, is_uploads_enabled: !!newState });
      }

      req.flash('success', `Guest uploads have been ${newState ? 'enabled' : 'disabled'}.`);
      return res.redirect(`/admin/events/${event.public_id}/edit`);
    } catch (error) {
      console.error('[EventController] Toggle uploads error:', error);
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(500).json({ success: false, message: 'Failed to toggle uploads' });
      }
      req.flash('error', 'Failed to toggle uploads.');
      return res.redirect(`/admin/events/${event.public_id}/edit`);
    }
  }

  /**
   * Delete Event
   */
  async deleteEvent(req, res) {
    const event = req.event;
    try {
      await query('DELETE FROM events WHERE id = ?', [event.id]);
      req.flash('success', `Event "${event.name}" and all associated media have been deleted.`);
      return res.redirect('/admin/events');
    } catch (error) {
      console.error('[EventController] Delete error:', error);
      req.flash('error', 'Failed to delete event.');
      return res.redirect('/admin/events');
    }
  }

  /**
   * Render Printable QR Code and Table Card
   */
  async getPrintCard(req, res) {
    const event = req.event;
    const eventUrl = qrService.getEventUrl(event.public_id, req);
    const qrDataUrl = await qrService.generateDataURL(eventUrl, {
      color: event.theme_color || '#1A1A1A'
    });

    res.render('admin/events/printCard', {
      title: `Print Table Sign | ${event.name}`,
      event,
      eventUrl,
      qrDataUrl
    });
  }

  /**
   * Render Guest Mobile Camera & Event Hub
   */
  async getGuestEventPage(req, res) {
    const { publicId } = req.params;

    try {
      let [rows] = await query('SELECT * FROM events WHERE public_id = ?', [publicId]);
      
      if ((!rows || rows.length === 0) && publicId === 'demo-wedding') {
        const { ensureDemoEvent } = require('../services/demoEventHelper');
        const demoEvent = await ensureDemoEvent();
        if (demoEvent) rows = [demoEvent];
      }

      if (!rows || rows.length === 0) {
        return res.status(404).render('partials/error', {
          title: 'Wedding Event Not Found',
          message: 'This wedding link or QR code does not match any active celebration.'
        });
      }

      const event = rows[0];

      let recentMedia = [];
      let totalMedia = 0;
      let totalPhotos = 0;
      let totalVideos = 0;
      let totalMessages = 0;

      try {
        const [mediaRows] = await query(
          `SELECT * FROM media WHERE event_id = ? AND status = 'active' ORDER BY uploaded_at DESC LIMIT 12`,
          [event.id]
        );
        recentMedia = mediaRows || [];
      } catch (e) {
        console.warn('[EventController] Recent media query notice:', e.message);
      }

      try {
        const [counts] = await query(
          `SELECT 
            COUNT(*) as total_media,
            COALESCE(SUM(CASE WHEN media_type = 'photo' THEN 1 ELSE 0 END), 0) as total_photos,
            COALESCE(SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END), 0) as total_videos
           FROM media WHERE event_id = ? AND status = 'active'`,
          [event.id]
        );
        if (counts && counts[0]) {
          totalMedia = Number(counts[0].total_media) || 0;
          totalPhotos = Number(counts[0].total_photos) || 0;
          totalVideos = Number(counts[0].total_videos) || 0;
        }
      } catch (e) {
        console.warn('[EventController] Media count query notice:', e.message);
      }

      try {
        const [msgCount] = await query(
          `SELECT COUNT(*) as total_messages FROM messages WHERE event_id = ? AND status = 'visible'`,
          [event.id]
        );
        if (msgCount && msgCount[0]) {
          totalMessages = Number(msgCount[0].total_messages) || 0;
        }
      } catch (e) {
        console.warn('[EventController] Message count query notice:', e.message);
      }

      res.render('guest/event', {
        title: `${event.name} | Digital Disposable Camera`,
        event,
        recentMedia,
        stats: {
          totalMedia,
          totalPhotos,
          totalVideos,
          totalMessages
        },
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('[EventController] Guest page error:', error);
      res.status(500).render('partials/error', {
        title: 'Error',
        message: 'Could not load the wedding celebration.'
      });
    }
  }
}

module.exports = new EventController();
