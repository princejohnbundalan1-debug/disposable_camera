const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');
const storageService = require('../storage/storageService');
const { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } = require('../config/constants');

/**
 * Media Processing Service
 * Handles thumbnail generation, image optimization, EXIF rotation, and metadata extraction.
 */
class MediaService {
  /**
   * Process and store an uploaded file
   * @param {object} file - Multer file object
   * @param {object} event - Event object
   * @param {string} uploaderName - Guest name
   * @param {string} caption - Optional caption
   */
  async processAndSaveMedia(file, eventId, uploaderName = 'Anonymous Guest', caption = null) {
    const isImage = ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype.toLowerCase());
    const isVideo = ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype.toLowerCase());

    if (!isImage && !isVideo) {
      throw new Error(`Unsupported media format: ${file.mimetype}`);
    }

    const mediaType = isImage ? 'photo' : 'video';
    const randomId = crypto.randomBytes(12).toString('hex');
    const originalExt = path.extname(file.originalname).toLowerCase() || (isImage ? '.jpg' : '.mp4');
    const storedFilename = `${Date.now()}-${randomId}${originalExt}`;
    const thumbFilename = `thumb-${Date.now()}-${randomId}.webp`;

    let width = null;
    let height = null;
    let thumbnailPath = null;
    let processedBuffer = file.buffer;

    if (isImage) {
      try {
        // Use Sharp to read metadata, auto-rotate according to EXIF orientation, and optimize
        const imagePipeline = sharp(file.buffer).rotate(); // auto-rotate
        const metadata = await imagePipeline.metadata();
        width = metadata.width || null;
        height = metadata.height || null;

        // Generate thumbnail (max width 450px, WebP format, high visual quality)
        const thumbBuffer = await sharp(file.buffer)
          .rotate()
          .resize(450, 450, {
            fit: 'cover',
            position: 'centre'
          })
          .webp({ quality: 80 })
          .toBuffer();

        // Save thumbnail to storage
        const savedThumb = await storageService.saveFile(thumbBuffer, thumbFilename, 'image/webp', 'thumbnails');
        thumbnailPath = savedThumb.path;

        // Optimize main image if it's overly huge (max 2560px for crystal-clear wedding prints)
        if (width && width > 2560) {
          processedBuffer = await sharp(file.buffer)
            .rotate()
            .resize(2560, null, { withoutEnlargement: true })
            .jpeg({ quality: 88 })
            .toBuffer();
        }
      } catch (sharpError) {
        console.warn('[MediaService] Sharp image processing error, saving original buffer:', sharpError.message);
      }
    }

    // Save main file to storage
    const savedFile = await storageService.saveFile(processedBuffer, storedFilename, file.mimetype, 'uploads');

    return {
      mediaType,
      originalFilename: file.originalname,
      storedFilename,
      storagePath: savedFile.path,
      thumbnailPath: thumbnailPath || savedFile.path,
      mimeType: file.mimetype,
      fileSize: processedBuffer.length || file.size,
      width,
      height,
      duration: null,
      uploaderName: uploaderName.trim() || 'Anonymous Guest',
      caption: caption ? caption.trim() : null
    };
  }
}

module.exports = new MediaService();
