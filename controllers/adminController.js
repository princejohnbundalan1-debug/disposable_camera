const { query } = require('../config/db');
const storageService = require('../storage/storageService');

class AdminController {
  /**
   * Main Organizer Dashboard
   */
  async getDashboard(req, res) {
    const userId = req.session.user.id;

    try {
      // 1. Fetch all events belonging to organizer
      const [events] = await query(
        `SELECT e.*,
          (SELECT COUNT(*) FROM media WHERE event_id = e.id AND status = 'active') as media_count,
          (SELECT COUNT(*) FROM messages WHERE event_id = e.id AND status = 'visible') as messages_count
         FROM events e
         WHERE e.organizer_id = ?
         ORDER BY e.created_at DESC`,
        [userId]
      );

      // 2. Fetch global statistics across all organizer events
      const [statsRows] = await query(
        `SELECT 
          COUNT(m.id) as total_media,
          SUM(CASE WHEN m.media_type = 'photo' THEN 1 ELSE 0 END) as total_photos,
          SUM(CASE WHEN m.media_type = 'video' THEN 1 ELSE 0 END) as total_videos,
          COALESCE(SUM(m.file_size), 0) as total_bytes
         FROM media m
         JOIN events e ON m.event_id = e.id
         WHERE e.organizer_id = ? AND m.status = 'active'`,
        [userId]
      );

      const [msgStats] = await query(
        `SELECT COUNT(msg.id) as total_messages
         FROM messages msg
         JOIN events e ON msg.event_id = e.id
         WHERE e.organizer_id = ? AND msg.status = 'visible'`,
        [userId]
      );

      // 3. Fetch latest 10 uploads across all events
      const [recentUploads] = await query(
        `SELECT m.*, e.name as event_name, e.public_id as event_public_id
         FROM media m
         JOIN events e ON m.event_id = e.id
         WHERE e.organizer_id = ? AND m.status = 'active'
         ORDER BY m.uploaded_at DESC
         LIMIT 10`,
        [userId]
      );

      // Format storage size
      const totalBytes = statsRows[0]?.total_bytes || 0;
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

      res.render('admin/dashboard', {
        title: 'Wedding Dashboard | Organizer Suite',
        events,
        stats: {
          totalEvents: events.length,
          totalMedia: statsRows[0]?.total_media || 0,
          totalPhotos: statsRows[0]?.total_photos || 0,
          totalVideos: statsRows[0]?.total_videos || 0,
          totalMessages: msgStats[0]?.total_messages || 0,
          totalMB,
          totalBytes
        },
        recentUploads: recentUploads.map(m => ({
          ...m,
          url: storageService.getFileUrl(m.storage_path),
          thumbnailUrl: storageService.getFileUrl(m.thumbnail_path)
        })),
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('[AdminController] Dashboard error:', error);
      req.flash('error', 'Could not load dashboard information.');
      res.render('admin/dashboard', {
        title: 'Wedding Dashboard',
        events: [],
        stats: { totalEvents: 0, totalMedia: 0, totalPhotos: 0, totalVideos: 0, totalMessages: 0, totalMB: '0.0' },
        recentUploads: [],
        error: ['Database connection could not be established or query failed.']
      });
    }
  }

  /**
   * Event Media Moderation & Batch Download View
   */
  async getManageMedia(req, res) {
    const event = req.event;

    try {
      const [mediaList] = await query(
        `SELECT * FROM media WHERE event_id = ? ORDER BY uploaded_at DESC`,
        [event.id]
      );

      const [messages] = await query(
        `SELECT * FROM messages WHERE event_id = ? ORDER BY created_at DESC`,
        [event.id]
      );

      res.render('admin/media/manage', {
        title: `Manage Media | ${event.name}`,
        event,
        mediaList: mediaList.map(m => ({
          ...m,
          url: storageService.getFileUrl(m.storage_path),
          thumbnailUrl: storageService.getFileUrl(m.thumbnail_path)
        })),
        messages,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('[AdminController] Manage media error:', error);
      req.flash('error', 'Could not load media management page.');
      res.redirect(`/admin/events/${event.public_id}/edit`);
    }
  }
}

module.exports = new AdminController();
