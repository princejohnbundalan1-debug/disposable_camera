const { query } = require('../config/db');
const mediaService = require('../services/mediaService');
const storageService = require('../storage/storageService');
const zipService = require('../services/zipService');

class MediaController {
  /**
   * Upload Media (Single or Multiple Photos/Videos)
   */
  async uploadMedia(req, res) {
    const { publicId } = req.params;
    const { guest_name, caption } = req.body;

    try {
      // 1. Fetch and validate event
      let [events] = await query('SELECT * FROM events WHERE public_id = ?', [publicId]);
      if ((!events || events.length === 0) && publicId === 'demo-wedding') {
        const { ensureDemoEvent } = require('../services/demoEventHelper');
        const demo = await ensureDemoEvent();
        if (demo) events = [demo];
      }
      if (!events || events.length === 0) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }

      const event = events[0];

      // Check if organizer disabled uploads
      if (!event.is_uploads_enabled) {
        return res.status(403).json({
          success: false,
          message: 'The hosts have temporarily closed media uploads for this event.'
        });
      }

      // Check uploaded files
      const files = req.files || (req.file ? [req.file] : []);
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'No media files were provided.' });
      }

      const uploadedResults = [];

      for (const file of files) {
        // Process media through Sharp thumbnailing and storage service
        const mediaData = await mediaService.processAndSaveMedia(
          file,
          event.id,
          guest_name || 'Anonymous Guest',
          caption || null
        );

        // Insert metadata record into MySQL
        const [insertResult] = await query(
          `INSERT INTO media (
            event_id, media_type, original_filename, stored_filename, storage_path, 
            thumbnail_path, mime_type, file_size, width, height, duration, 
            uploader_name, caption, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            event.id,
            mediaData.mediaType,
            mediaData.originalFilename,
            mediaData.storedFilename,
            mediaData.storagePath,
            mediaData.thumbnailPath,
            mediaData.mimeType,
            mediaData.fileSize,
            mediaData.width,
            mediaData.height,
            mediaData.duration,
            mediaData.uploaderName,
            mediaData.caption
          ]
        );

        uploadedResults.push({
          id: insertResult.insertId,
          mediaType: mediaData.mediaType,
          url: storageService.getFileUrl(mediaData.storagePath),
          thumbnailUrl: storageService.getFileUrl(mediaData.thumbnailPath),
          uploaderName: mediaData.uploaderName,
          caption: mediaData.caption,
          uploadedAt: new Date()
        });
      }

      // Return response
      if (req.xhr || req.headers.accept?.includes('json') || req.is('multipart/form-data')) {
        return res.status(201).json({
          success: true,
          message: `Successfully uploaded ${uploadedResults.length} moment${uploadedResults.length > 1 ? 's' : ''}!`,
          media: uploadedResults
        });
      }

      req.flash('success', 'Your photo has been added to the wedding roll!');
      return res.redirect(`/e/${publicId}/album`);
    } catch (error) {
      console.error('[MediaController] Upload error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Upload failed. Please try again.'
      });
    }
  }

  /**
   * Render Shared Guest Album Page
   */
  async getGuestAlbumPage(req, res) {
    const { publicId } = req.params;

    try {
      let [events] = await query('SELECT * FROM events WHERE public_id = ?', [publicId]);
      if ((!events || events.length === 0) && publicId === 'demo-wedding') {
        const { ensureDemoEvent } = require('../services/demoEventHelper');
        const demo = await ensureDemoEvent();
        if (demo) events = [demo];
      }

      if (!events || events.length === 0) {
        return res.status(404).render('partials/error', {
          title: 'Album Not Found',
          message: 'The requested wedding album could not be found.'
        });
      }

      const event = events[0];

      // Get all active media
      const [mediaList] = await query(
        `SELECT * FROM media WHERE event_id = ? AND status = 'active' ORDER BY uploaded_at DESC`,
        [event.id]
      );

      res.render('guest/album', {
        title: `${event.name} | Shared Album`,
        event,
        mediaList: mediaList.map((m) => ({
          ...m,
          url: storageService.getFileUrl(m.storage_path),
          thumbnailUrl: storageService.getFileUrl(m.thumbnail_path)
        })),
        storageService,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('[MediaController] Album page error:', error);
      res.status(500).render('partials/error', {
        title: 'Error',
        message: 'Could not load the photo album.'
      });
    }
  }

  /**
   * API: Get Media JSON for infinite scroll / filtering
   */
  async getMediaApi(req, res) {
    const { publicId } = req.params;
    const { type, page = 1, limit = 30 } = req.query;

    try {
      const [events] = await query('SELECT id FROM events WHERE public_id = ?', [publicId]);
      if (!events || events.length === 0) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }

      const eventId = events[0].id;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      let sql = `SELECT * FROM media WHERE event_id = ? AND status = 'active'`;
      const params = [eventId];

      if (type && (type === 'photo' || type === 'video')) {
        sql += ' AND media_type = ?';
        params.push(type);
      }

      sql += ' ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10), offset);

      const [mediaItems] = await query(sql, params);

      return res.json({
        success: true,
        page: parseInt(page, 10),
        data: mediaItems.map((m) => ({
          ...m,
          url: storageService.getFileUrl(m.storage_path),
          thumbnailUrl: storageService.getFileUrl(m.thumbnail_path)
        }))
      });
    } catch (error) {
      console.error('[MediaController] API getMedia error:', error);
      return res.status(500).json({ success: false, message: 'Could not retrieve media.' });
    }
  }

  /**
   * Delete single media item (Organizer only)
   */
  async deleteMedia(req, res) {
    const { id } = req.params;

    try {
      const [rows] = await query(
        `SELECT m.*, e.organizer_id, e.public_id 
         FROM media m 
         JOIN events e ON m.event_id = e.id 
         WHERE m.id = ?`,
        [id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Media not found.' });
      }

      const mediaItem = rows[0];

      // Verify ownership (allow demo-wedding or matching organizer or admin)
      if (mediaItem.organizer_id !== req.session.user.id && req.session.user.role !== 'admin' && mediaItem.public_id !== 'demo-wedding') {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
      }

      // Delete files from storage
      await storageService.deleteFile(mediaItem.storage_path);
      if (mediaItem.thumbnail_path && mediaItem.thumbnail_path !== mediaItem.storage_path) {
        await storageService.deleteFile(mediaItem.thumbnail_path);
      }

      // Remove from database
      await query('DELETE FROM media WHERE id = ?', [id]);

      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.json({ success: true, message: 'Media deleted successfully.' });
      }

      req.flash('success', 'Media item deleted.');
      return res.redirect('back');
    } catch (error) {
      console.error('[MediaController] Delete error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete media.' });
    }
  }

  /**
   * Download single media item
   */
  async downloadMedia(req, res) {
    const { id } = req.params;

    try {
      const [rows] = await query('SELECT * FROM media WHERE id = ? AND status = "active"', [id]);
      if (!rows || rows.length === 0) {
        return res.status(404).send('Media item not found.');
      }

      const item = rows[0];
      const stream = await storageService.getFileStream(item.storage_path);
      const downloadName = item.original_filename || item.stored_filename;

      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Type', item.mime_type || 'application/octet-stream');
      stream.pipe(res);
    } catch (error) {
      console.error('[MediaController] Download error:', error);
      res.status(500).send('Error downloading file.');
    }
  }

  /**
   * Batch Download all event media as ZIP (Organizer)
   */
  async downloadAllZip(req, res) {
    const event = req.event;

    try {
      const [mediaList] = await query(
        `SELECT * FROM media WHERE event_id = ? AND status = 'active' ORDER BY uploaded_at ASC`,
        [event.id]
      );

      if (!mediaList || mediaList.length === 0) {
        req.flash('error', 'No photos or videos are available to download yet.');
        return res.redirect(`/admin/events/${event.public_id}/manage`);
      }

      await zipService.streamMediaZip(mediaList, event.name, res);
    } catch (error) {
      console.error('[MediaController] ZIP download error:', error);
      if (!res.headersSent) {
        req.flash('error', 'Failed to generate ZIP archive.');
        res.redirect(`/admin/events/${event.public_id}/manage`);
      }
    }
  }
}

module.exports = new MediaController();
