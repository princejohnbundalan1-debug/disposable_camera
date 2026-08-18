const path = require('path');
const LocalStorageProvider = require('./providers/localStorageProvider');
const S3StorageProvider = require('./providers/s3StorageProvider');
const SupabaseStorageProvider = require('./providers/supabaseStorageProvider');

/**
 * Abstract Storage Service Factory
 * Decouples file persistence from backend business logic.
 */
class StorageService {
  constructor() {
    const providerType = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

    switch (providerType) {
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
