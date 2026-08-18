-- ==============================================================================
-- QR-Based Digital Disposable Camera & Wedding Photo Album Database Schema
-- Database: MySQL 8.0+
-- Collation: utf8mb4_unicode_ci (Supports modern emoji & international characters)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS wedding_disposable_camera
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE wedding_disposable_camera;

-- ------------------------------------------------------------------------------
-- 1. Users Table (Organizers & System Administrators)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'organizer',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Events Table (Weddings & Special Celebrations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(64) NOT NULL UNIQUE,
  organizer_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  couple_names VARCHAR(150) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  event_date DATE DEFAULT NULL,
  cover_image VARCHAR(255) DEFAULT NULL,
  theme_color VARCHAR(20) DEFAULT '#C5A880',
  is_uploads_enabled TINYINT(1) NOT NULL DEFAULT 1,
  privacy_mode ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_events_public_id (public_id),
  INDEX idx_events_organizer (organizer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Media Table (Photos and Videos captured or uploaded by Guests)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  media_type ENUM('photo', 'video') NOT NULL DEFAULT 'photo',
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  storage_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500) DEFAULT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  width INT DEFAULT NULL,
  height INT DEFAULT NULL,
  duration INT DEFAULT NULL,
  uploader_name VARCHAR(100) DEFAULT 'Anonymous Guest',
  caption VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'hidden', 'deleted') NOT NULL DEFAULT 'active',
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_media_event_status (event_id, status),
  INDEX idx_media_uploaded_at (uploaded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Messages Table (Wedding Guestbook Messages & Wishes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  guest_name VARCHAR(100) NOT NULL DEFAULT 'Anonymous Guest',
  message TEXT NOT NULL,
  status ENUM('visible', 'hidden', 'flagged') NOT NULL DEFAULT 'visible',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_messages_event_status (event_id, status),
  INDEX idx_messages_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
