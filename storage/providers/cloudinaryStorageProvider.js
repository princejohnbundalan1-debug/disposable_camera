const cloudinary = require('cloudinary').v2;
const https = require('https');
const http = require('http');

/**
 * Cloudinary Storage Provider
 * Permanent free cloud storage for photos and videos.
 * Preserves media across all server deployments and container restarts.
 */
class CloudinaryStorageProvider {
  constructor() {
    const rawUrl = (process.env.CLOUDINARY_URL || '').trim().replace(/^['"]|['"]$/g, '');

    if (rawUrl && rawUrl.startsWith('cloudinary://')) {
      const match = rawUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
      if (match) {
        cloudinary.config({
          api_key: match[1].trim(),
          api_secret: match[2].trim(),
          cloud_name: match[3].trim(),
          secure: true
        });
        console.log(`[CloudinaryStorageProvider] Configured for cloud: ${match[3].trim()}`);
      } else {
        cloudinary.config(true);
      }
    } else if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
        api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
        api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
        secure: true
      });
    } else {
      cloudinary.config(true);
    }
  }

  getName() {
    return 'CloudinaryStorageProvider (Permanent Cloud Storage)';
  }

  /**
   * Upload buffer to Cloudinary
   */
  async saveFile(buffer, filename, mimeType, folder = 'uploads') {
    const isVideo = mimeType && mimeType.startsWith('video');
    const resourceType = isVideo ? 'video' : 'image';
    const folderPath = `wedding_disposable/${folder}`;
    const cleanPublicId = filename.replace(/\.[^/.]+$/, '');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: cleanPublicId,
          resource_type: resourceType,
          overwrite: true
        },
        (error, result) => {
          if (error) {
            console.error('[CloudinaryStorageProvider] Upload error:', error);
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
    return cloudinary.url(filePath, { secure: true });
  }

  /**
   * Fetch stream for bulk ZIP download
   */
  async getFileStream(filePath) {
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
