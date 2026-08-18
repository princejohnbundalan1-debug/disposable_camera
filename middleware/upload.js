const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES, MAX_VIDEO_SIZE } = require('../config/constants');

// Combine allowed MIME types
const ALLOWED_MIMES = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES];

// Multer memory storage allows direct streaming into Sharp for thumbnails + storageService without orphaned temp files
const storage = multer.memoryStorage();

// File filter validates MIME types
const fileFilter = (req, file, cb) => {
  const isAllowed = ALLOWED_MIMES.includes(file.mimetype.toLowerCase());
  
  // Extension secondary check
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm', '.mkv'];
  
  if (isAllowed || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype || ext}. Please upload JPG, PNG, WEBP, or MP4/MOV videos.`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Global max ceiling (50MB)
    files: 10 // Max 10 files per batch upload
  },
  fileFilter: fileFilter
});

module.exports = upload;
