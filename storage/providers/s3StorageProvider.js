/**
 * AWS S3 / Cloudflare R2 / MinIO Storage Provider Template
 * Demonstrates pluggable cloud storage abstraction for production.
 */
class S3StorageProvider {
  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || 'wedding-albums';
    this.region = process.env.S3_REGION || 'us-east-1';
    this.customDomain = process.env.S3_CUSTOM_DOMAIN || null;
  }

  getName() {
    return 'S3StorageProvider (AWS S3 / Cloudflare R2)';
  }

  async saveFile(buffer, filename, mimeType, folder = 'uploads') {
    const key = `${folder}/${filename}`;
    // When using AWS SDK in production:
    // const s3 = new AWS.S3({ ... });
    // await s3.putObject({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }).promise();
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
    // await s3.deleteObject({ Bucket: this.bucket, Key: filePath }).promise();
    return true;
  }

  getFileUrl(filePath) {
    if (this.customDomain) {
      return `${this.customDomain}/${filePath}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filePath}`;
  }

  async getFileStream(filePath) {
    // return s3.getObject({ Bucket: this.bucket, Key: filePath }).createReadStream();
    throw new Error('S3 provider not configured with active AWS credentials');
  }
}

module.exports = S3StorageProvider;
