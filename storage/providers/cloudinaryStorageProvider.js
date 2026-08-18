const cloudinary = require('cloudinary').v2;
const https = require('https');
const http = require('http');
const LocalStorageProvider = require('./localStorageProvider');

/**
 * Cloudinary Storage Provider
 * Permanent free cloud storage for photos and videos with automatic local fallback.
 */
class CloudinaryStorageProvider {
  constructor() {
    this.fallbackLocal = new LocalStorageProvider();
    this.isConfigured = false;

    let rawUrl = (process.env.CLOUDINARY_URL || '').trim();
    // Clean any accidental "export" or "CLOUDINARY_URL=" prefix or quotes
    rawUrl = rawUrl.replace(/^export\s+/i, '').replace(/^CLOUDINARY_URL\s*=\s*/i, '');
    rawUrl = rawUrl.replace(/^['"]+|['"]+$/g, '').trim();

    if (rawUrl && rawUrl.startsWith('cloudinary://')) {
      try {
        const withoutPrefix = rawUrl.substring('cloudinary://'.length);
        const atIndex = withoutPrefix.lastIndexOf('@');
        if (atIndex !== -1) {
          const authPart = withoutPrefix.substring(0, atIndex);
          const cloudName = withoutPrefix.substring(atIndex + 1).trim();
          const colonIndex = authPart.indexOf(':');
          if (colonIndex !== -1) {
            const apiKey = authPart.substring(0, colonIndex).trim();
            const apiSecret = decodeURIComponent(authPart.substring(colonIndex + 1).trim());

            cloudinary.config({
              cloud_name: cloudName,
              api_key: apiKey,
              api_secret: apiSecret,
              secure: true
            });
            this.isConfigured = true;
            console.log(`[CloudinaryStorageProvider] Configured successfully for cloud: "${cloudName}"`);
          }
        }
      } catch (e) {
        console.warn('[CloudinaryStorageProvider] Error parsing CLOUDINARY_URL:', e.message);
      }
    } else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
        api_key: process.env.CLOUDINARY_API_KEY.trim(),
        api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
        secure: true
      });
      this.isConfigured = true;
      console.log(`[CloudinaryStorageProvider] Configured via discrete keys for cloud: "${process.env.CLOUDINARY_CLOUD_NAME.trim()}"`);
    }

    if (!this.isConfigured) {
      console.warn('[CloudinaryStorageProvider] Cloudinary credentials not fully recognized, fallback to Local Storage enabled.');
    }
  }

  getName() {
    return 'CloudinaryStorageProvider (Permanent Cloud Storage)';
  }

  /**
   * Upload buffer to Cloudinary with safe local fallback
   */
  async saveFile(buffer, filename, mimeType, folder = 'uploads') {
    const isVideo = mimeType && mimeType.startsWith('video');
    const resourceType = isVideo ? 'video' : 'image';
    const folderPath = `wedding_disposable/${folder}`;
    const cleanPublicId = filename.replace(/\.[^/.]+$/, '');

    try {
      if (!this.isConfigured) {
        throw new Error('Cloudinary not configured');
      }

      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            public_id: cleanPublicId,
            resource_type: resourceType,
            overwrite: true
          },
          (error, result) => {
            if (error) {
              return reject(error);
            }
            resolve({
              path: result.secure_url,
              url: result.secure_url,
              publicId: result.public_id,
              bytes: result.bytes,
              width: result.width,
              height: result.height
            });
          }
        );

        uploadStream.end(buffer);
      });
    } catch (cloudErr) {
      console.warn(`[CloudinaryStorageProvider] Cloud upload notice (${cloudErr.message}), saving to local storage fallback.`);
      return await this.fallbackLocal.saveFile(buffer, filename, mimeType, folder);
    }
  }

  /**
   * Upload from local temp path
   */
  async saveFromPath(tempPath, filename, mimeType, folder = 'uploads') {
    const isVideo = mimeType && mimeType.startsWith('video');
    const resourceType = isVideo ? 'video' : 'image';
    const folderPath = `wedding_disposable/${folder}`;
    const cleanPublicId = filename.replace(/\.[^/.]+$/, '');

    const result = await cloudinary.uploader.upload(tempPath, {
      folder: folderPath,
      public_id: cleanPublicId,
      resource_type: resourceType,
      overwrite: true
    });

    return {
      path: result.secure_url,
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      width: result.width,
      height: result.height
    };
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(filePath) {
    try {
      if (!filePath) return true;
      
      // If it's a full URL, extract the public ID
      let publicId = filePath;
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        const matches = filePath.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
        if (matches && matches[1]) {
          publicId = matches[1];
        }
      }

      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (err) {
      console.error(`[CloudinaryStorageProvider] Delete error for ${filePath}:`, err.message);
      return false;
    }
  }

  /**
   * Get public web URL
   */
  getFileUrl(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    if (filePath.startsWith('uploads/') || filePath.startsWith('thumbnails/')) {
      return this.fallbackLocal.getFileUrl(filePath);
    }
    return cloudinary.url(filePath, { secure: true });
  }

  /**
   * Fetch stream for bulk ZIP download
   */
  async getFileStream(filePath) {
    if (filePath.startsWith('uploads/') || filePath.startsWith('thumbnails/')) {
      return await this.fallbackLocal.getFileStream(filePath);
    }
    const url = this.getFileUrl(filePath);
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Failed to download file from Cloudinary: status ${res.statusCode}`));
        }
        resolve(res);
      }).on('error', reject);
    });
  }
}

module.exports = CloudinaryStorageProvider;
