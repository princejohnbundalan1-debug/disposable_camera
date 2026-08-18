/**
 * Supabase Storage Provider Template
 * Demonstrates pluggable Supabase storage abstraction for production.
 */
class SupabaseStorageProvider {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.bucket = process.env.SUPABASE_BUCKET || 'wedding-media';
  }

  getName() {
    return 'SupabaseStorageProvider';
  }

  async saveFile(buffer, filename, mimeType, folder = 'uploads') {
    const key = `${folder}/${filename}`;
    // const { data, error } = await supabase.storage.from(this.bucket).upload(key, buffer, { contentType: mimeType });
    return {
      path: key,
      url: this.getFileUrl(key)
    };
  }

  async saveFromPath(tempPath, filename, mimeType, folder = 'uploads') {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(tempPath);
    return await this.saveFile(buffer, filename, mimeType, folder);
  }

  async deleteFile(filePath) {
    // await supabase.storage.from(this.bucket).remove([filePath]);
    return true;
  }

  getFileUrl(filePath) {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${filePath}`;
  }

  async getFileStream(filePath) {
    throw new Error('Supabase provider not configured with active credentials');
  }
}

module.exports = SupabaseStorageProvider;
