const { query } = require('../config/db');
const { sanitizeInput } = require('../middleware/security');

class MessageController {
  /**
   * Render Guestbook Page for Guests
   */
  async getGuestbookPage(req, res) {
    const { publicId } = req.params;

    try {
      const [events] = await query('SELECT * FROM events WHERE public_id = ?', [publicId]);
      if (!events || events.length === 0) {
        return res.status(404).render('partials/error', {
          title: 'Event Not Found',
          message: 'The requested event could not be found.'
        });
      }

      const event = events[0];

      const [messages] = await query(
        `SELECT * FROM messages WHERE event_id = ? AND status = 'visible' ORDER BY created_at DESC`,
        [event.id]
      );

      res.render('guest/guestbook', {
        title: `${event.name} | Guestbook & Wishes`,
        event,
        messages,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('[MessageController] Guestbook page error:', error);
      res.status(500).render('partials/error', {
        title: 'Error',
        message: 'Could not load the guestbook.'
      });
    }
  }

  /**
   * Post a new guestbook message
   */
  async postMessage(req, res) {
    const { publicId } = req.params;
    const { guest_name, message } = req.body;

    if (!message || !message.trim()) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(400).json({ success: false, message: 'Message text cannot be empty.' });
      }
      req.flash('error', 'Please write a message before sending.');
      return res.redirect(`/e/${publicId}/guestbook`);
    }

    try {
      const [events] = await query('SELECT id FROM events WHERE public_id = ?', [publicId]);
      if (!events || events.length === 0) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }

      const eventId = events[0].id;
      const cleanGuestName = (guest_name && guest_name.trim()) ? guest_name.trim().substring(0, 100) : 'Anonymous Guest';
      const cleanMessage = message.trim().substring(0, 2000);

      const [insertResult] = await query(
        `INSERT INTO messages (event_id, guest_name, message, status) VALUES (?, ?, ?, 'visible')`,
        [eventId, cleanGuestName, cleanMessage]
      );

      const newMessage = {
        id: insertResult.insertId,
        guest_name: cleanGuestName,
        message: cleanMessage,
        created_at: new Date()
      };

      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(201).json({
          success: true,
          message: 'Thank you for your lovely message!',
          data: newMessage
        });
      }

      req.flash('success', 'Your wish has been posted to the couple!');
      return res.redirect(`/e/${publicId}/guestbook`);
    } catch (error) {
      console.error('[MessageController] Post message error:', error);
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(500).json({ success: false, message: 'Could not post message.' });
      }
      req.flash('error', 'Failed to submit your message.');
      return res.redirect(`/e/${publicId}/guestbook`);
    }
  }

  /**
   * Delete a message (Organizer only)
   */
  async deleteMessage(req, res) {
    const { id } = req.params;

    try {
      const [rows] = await query(
        `SELECT m.*, e.organizer_id 
         FROM messages m 
         JOIN events e ON m.event_id = e.id 
         WHERE m.id = ?`,
        [id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Message not found.' });
      }

      const msg = rows[0];
      if (msg.organizer_id !== req.session.user.id && req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
      }

      await query('DELETE FROM messages WHERE id = ?', [id]);

      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.json({ success: true, message: 'Message removed.' });
      }

      req.flash('success', 'Message removed.');
      return res.redirect('back');
    } catch (error) {
      console.error('[MessageController] Delete message error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete message.' });
    }
  }
}

module.exports = new MessageController();
