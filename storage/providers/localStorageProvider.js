const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Local File System Storage Provider
 * Zero external cost, ideal for local development, on-premise, or self-hosted deployment.
 */
class LocalStorageProvider {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../../storage');
    this.uploadsDir = path.join(this.baseDir, 'uploads');
    this.thumbnailsDir = path.join(this.baseDir, 'thumbnails');

    // Ensure storage directories exist synchronously on initialization
    this.ensureDirectory(this.uploadsDir);
    this.ensureDirectory(this.thumbnailsDir);
  }

  getName() {
    return 'LocalStorageProvider (Local File System)';
  }

  ensureDirectory(dirPath) {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
    }
  }

  getFolderDirectory(folder) {
    return folder === 'thumbnails' ? this.thumbnailsDir : this.uploadsDir;
  }

  /**
   * Save buffer to local disk
   */
  async saveFile(buffer, filename, mimeType, folder = 'uploads') {
    const targetDir = this.getFolderDirectory(folder);
    this.ensureDirectory(targetDir);

    const safeFilename = path.basename(filename);
    const destinationPath = path.join(targetDir, safeFilename);

    await fs.writeFile(destinationPath, buffer);

    const relativePath = `${folder}/${safeFilename}`;
    const url = `/storage-files/${relativePath}`;

    return {
      path: relativePath,
      url: url,
      absolutePath: destinationPath
    };
  }

  /**
   * Save / move from temp file path
   */
  async saveFromPath(tempPath, filename, mimeType, folder = 'uploads') {
    const targetDir = this.getFolderDirectory(folder);
    this.ensureDirectory(targetDir);

    const safeFilename = path.basename(filename);
    const destinationPath = path.join(targetDir, safeFilename);

    await fs.copyFile(tempPath, destinationPath);
    // Cleanup temporary multer file if different
    if (tempPath !== destinationPath && fsSync.existsSync(tempPath)) {
      await fs.unlink(tempPath).catch(() => {});
    }

    const relativePath = `${folder}/${safeFilename}`;
    const url = `/storage-files/${relativePath}`;

    return {
      path: relativePath,
      url: url,
      absolutePath: destinationPath
    };
  }

  /**
   * Delete file from local disk
   */
  async deleteFile(filePath) {
    try {
      const safeRelative = filePath.replace(/^\/+/, '');
      const fullPath = path.join(this.baseDir, safeRelative);
      
      // Prevent path traversal
      if (!fullPath.startsWith(this.baseDir)) {
        throw new Error('Invalid file path for deletion');
      }

      if (fsSync.existsSync(fullPath)) {
        await fs.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[LocalStorageProvider] Delete error for ${filePath}:`, err.message);
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
    const cleanPath = filePath.replace(/^\/+/, '');
    return `/storage-files/${cleanPath}`;
  }

  /**
   * Get file stream for read / zip
   */
  async getFileStream(filePath) {
    const safeRelative = filePath.replace(/^\/+/, '');
    const fullPath = path.join(this.baseDir, safeRelative);

    if (!fullPath.startsWith(this.baseDir) || !fsSync.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fsSync.createReadStream(fullPath);
  }
}

module.exports = LocalStorageProvider;
