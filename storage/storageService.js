const path = require('path');
const LocalStorageProvider = require('./providers/localStorageProvider');
const S3StorageProvider = require('./providers/s3StorageProvider');
const SupabaseStorageProvider = require('./providers/supabaseStorageProvider');
const CloudinaryStorageProvider = require('./providers/cloudinaryStorageProvider');

/**
 * Abstract Storage Service Factory
 * Decouples file persistence from backend business logic.
 */
class StorageService {
  constructor() {
    let providerType = (process.env.STORAGE_PROVIDER || '').toLowerCase();

    // Auto-detect Cloudinary if CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME is present
    if (!providerType) {
      if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
        providerType = 'cloudinary';
      } else if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
        providerType = 'supabase';
      } else {
        providerType = 'local';
      }
    }

    switch (providerType) {
      case 'cloudinary':
        this.provider = new CloudinaryStorageProvider();
        break;
      case 's3':
      case 'r2':
        this.provider = new S3StorageProvider();
        break;
      case 'supabase':
        this.provider = new SupabaseStorageProvider();
        break;
      case 'local':
      default:
        this.provider = new LocalStorageProvider();
        break;
    }

    console.log(`[StorageService] Active storage provider: ${this.provider.getName()}`);
  }

  /**
   * Save a file buffer to storage
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Stored filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - 'uploads' or 'thumbnails'
   * @returns {Promise<{path: string, url: string}>}
   */
  async saveFile(buffer, filename, mimeType, folder = 'uploads') {
    return await this.provider.saveFile(buffer, filename, mimeType, folder);
  }

  /**
   * Move / save an uploaded file from disk (e.g. from multer disk storage)
   * @param {string} tempPath - Temporary file path on disk
   * @param {string} filename - Destination filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - 'uploads' or 'thumbnails'
   * @returns {Promise<{path: string, url: string}>}
   */
  async saveFromPath(tempPath, filename, mimeType, folder = 'uploads') {
    return await this.provider.saveFromPath(tempPath, filename, mimeType, folder);
  }

  /**
   * Delete a file from storage
   * @param {string} filePath - Stored file path
   * @returns {Promise<boolean>}
   */
  async deleteFile(filePath) {
    return await this.provider.deleteFile(filePath);
  }

  /**
   * Get public web URL for a stored file
   * @param {string} filePath - Stored file path
   * @returns {string}
   */
  getFileUrl(filePath) {
    return this.provider.getFileUrl(filePath);
  }

  /**
   * Get stream or buffer for reading (e.g. for batch ZIP archiving)
   * @param {string} filePath - Stored file path
   * @returns {Promise<ReadableStream | Buffer>}
   */
  async getFileStream(filePath) {
    return await this.provider.getFileStream(filePath);
  }
}

// Export singleton instance
module.exports = new StorageService();
