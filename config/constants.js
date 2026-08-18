/**
 * Application Constants & Configuration Defaults
 */

module.exports = {
  // Allowed MIME Types
  ALLOWED_IMAGE_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ],
  
  ALLOWED_VIDEO_MIME_TYPES: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska'
  ],

  // Max File Sizes (Bytes)
  MAX_IMAGE_SIZE: (parseInt(process.env.MAX_IMAGE_SIZE_MB, 10) || 15) * 1024 * 1024,
  MAX_VIDEO_SIZE: (parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 50) * 1024 * 1024,

  // Status Enums
  MEDIA_STATUS: {
    ACTIVE: 'active',
    HIDDEN: 'hidden',
    DELETED: 'deleted'
  },

  MESSAGE_STATUS: {
    VISIBLE: 'visible',
    HIDDEN: 'hidden',
    FLAGGED: 'flagged'
  },

  EVENT_PRIVACY: {
    PUBLIC: 'PUBLIC',
    PRIVATE: 'PRIVATE'
  },

  USER_ROLES: {
    ADMIN: 'admin',
    ORGANIZER: 'organizer'
  },

  // Color Themes for Wedding Aesthetics
  THEMES: {
    CHAMPAGNE: { id: 'champagne', name: 'Champagne Gold', primary: '#C5A880', secondary: '#E6D7C3' },
    ROSE_GOLD: { id: 'rose_gold', name: 'Rose Gold', primary: '#B76E79', secondary: '#F4DCD6' },
    EMERALD: { id: 'emerald', name: 'Emerald Velvet', primary: '#1B4D3E', secondary: '#85A392' },
    MIDNIGHT: { id: 'midnight', name: 'Midnight Onyx', primary: '#2C3E50', secondary: '#BDC3C7' },
    LAVENDER: { id: 'lavender', name: 'Romantic Lilac', primary: '#8E7CC3', secondary: '#D9D2E9' }
  }
};
