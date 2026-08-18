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
    this.ensureConfig();
  }

  ensureConfig() {
    let rawUrl = (process.env.CLOUDINARY_URL || '').trim();
    // Clean accidental prefixes or quotes
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
            let apiSecret = authPart.substring(colonIndex + 1).trim();
            try {
              apiSecret = decodeURIComponent(apiSecret);
            } catch (_) {}

            cloudinary.config({
              cloud_name: cloudName,
              api_key: apiKey,
              api_secret: apiSecret,
              secure: true
            });
            this.isConfigured = true;
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
    }
  }

  getConfigDebug() {
    this.ensureConfig();
    const conf = cloudinary.config();
    return {
      isConfigured: this.isConfigured,
      cloud_name: conf.cloud_name || null,
      api_key: conf.api_key || null,
      api_secret_present: !!conf.api_secret,
      api_secret_len: conf.api_secret ? conf.api_secret.length : 0,
      api_secret_first4: conf.api_secret ? conf.api_secret.substring(0, 4) : null,
      api_secret_last4: conf.api_secret ? conf.api_secret.slice(-4) : null
    };
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
    const { Readable } = require('stream');

    try {
      this.ensureConfig();
      if (!this.isConfigured) {
        throw new Error('Cloudinary not configured');
      }

      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            resource_type: resourceType
          },
          (error, result) => {
            if (error) {
              console.error('[CloudinaryStorageProvider] Upload error:', error.message);
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

        Readable.from(buffer).pipe(uploadStream);
      });
    } catch (cloudErr) {
      console.warn(`[CloudinaryStorageProvider] Cloud upload notice (${cloudErr.message}), saving to local storage fallback.`);
      return await this.fallbackLocal.saveFile(buffer, filename, mimeType, folder);
    }
  }

  /**
   * Test Cloudinary connection using the API ping endpoint (uses HTTP Basic auth, no HMAC signature).
   */
  async testConnection() {
    this.ensureConfig();
    if (!this.isConfigured) {
      return { success: false, message: 'Cloudinary credentials not configured' };
    }

    try {
      const result = await cloudinary.api.ping();
      return { success: true, status: result.status, details: result };
    } catch (err) {
      // Serialize full error for diagnostics
      const errDetails = {
        message: err.message,
        http_code: err.http_code,
        name: err.name,
        error: err.error,
        raw: JSON.stringify(err)
      };
      return { success: false, error: errDetails };
    }
  }

  /**
   * Upload from local temp path
   */
  async saveFromPath(tempPath, filename, mimeType, folder = 'uploads') {
    const isVideo = mimeType && mimeType.startsWith('video');
    const resourceType = isVideo ? 'video' : 'image';
    const folderPath = `wedding_disposable/${folder}`;

    const result = await cloudinary.uploader.upload(tempPath, {
      folder: folderPath,
      resource_type: resourceType
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
