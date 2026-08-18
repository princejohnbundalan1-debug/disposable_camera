const archiver = require('archiver');
const storageService = require('../storage/storageService');

/**
 * Service to create a streaming ZIP archive of all event media
 */
class ZipService {
  /**
   * Stream a zip archive of media files directly to the response
   * @param {Array} mediaList - Array of media records from DB
   * @param {string} eventName - Name of the event for the archive filename
   * @param {object} res - Express response stream
   */
  async streamMediaZip(mediaList, eventName, res) {
    const safeEventName = eventName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${safeEventName}_photos_${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', {
      zlib: { level: 5 } // balanced compression and CPU speed
    });

    archive.on('error', (err) => {
      console.error('[ZipService] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).send({ success: false, message: 'Error generating ZIP archive.' });
      }
    });

    archive.pipe(res);

    for (let i = 0; i < mediaList.length; i++) {
      const item = mediaList[i];
      try {
        const stream = await storageService.getFileStream(item.storage_path);
        const fileExt = item.stored_filename.split('.').pop() || 'jpg';
        const zipEntryName = `${item.media_type}s/${String(i + 1).padStart(3, '0')}_${item.uploader_name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${item.id}.${fileExt}`;
        archive.append(stream, { name: zipEntryName });
      } catch (fileErr) {
        console.warn(`[ZipService] Could not include file in ZIP (${item.storage_path}):`, fileErr.message);
      }
    }

    await archive.finalize();
  }
}

module.exports = new ZipService();
