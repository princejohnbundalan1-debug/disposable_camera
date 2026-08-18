const QRCode = require('qrcode');

/**
 * QR Code Generation Service
 */
class QRService {
  /**
   * Generates a Data URL (base64 image) for an event URL
   * @param {string} url - Target URL to encode
   * @param {object} options - Custom styling options
   * @returns {Promise<string>} - Base64 Data URL
   */
  async generateDataURL(url, options = {}) {
    try {
      const qrOptions = {
        errorCorrectionLevel: 'H', // High error correction allows center logos/emojis
        type: 'image/png',
        quality: 0.95,
        margin: 2,
        scale: 10, // High-resolution output for crisp printing
        color: {
          dark: options.color || '#1A1A1A',
          light: '#FFFFFF'
        },
        ...options
      };

      return await QRCode.toDataURL(url, qrOptions);
    } catch (error) {
      console.error('[QRService] Error generating Data URL:', error);
      throw error;
    }
  }

  /**
   * Generates an SVG string representation of the QR code
   */
  async generateSVG(url, options = {}) {
    try {
      const qrOptions = {
        errorCorrectionLevel: 'H',
        type: 'svg',
        margin: 2,
        color: {
          dark: options.color || '#1A1A1A',
          light: '#FFFFFF'
        },
        ...options
      };

      return await QRCode.toString(url, qrOptions);
    } catch (error) {
      console.error('[QRService] Error generating SVG:', error);
      throw error;
    }
  }

  /**
   * Construct absolute event URL for guests
   */
  getEventUrl(publicId, req = null) {
    let baseUrl = process.env.APP_URL || 'http://localhost:3000';
    if (req) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      baseUrl = `${protocol}://${host}`;
    }
    return `${baseUrl}/e/${publicId}`;
  }
}

module.exports = new QRService();
