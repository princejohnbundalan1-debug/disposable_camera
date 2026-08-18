const assert = require('assert');
const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('../config/db');
const qrService = require('../services/qrService');
const mediaService = require('../services/mediaService');
const storageService = require('../storage/storageService');
const sharp = require('sharp');

async function runE2ETests() {
  console.log('\n💍 ========================================================');
  console.log('🚀 Running Wedding Disposable Camera End-to-End Test Flow...');
  console.log('========================================================\n');

  // 1. Initialize Database
  await initDatabase();

  // 2. Register Organizer
  console.log('1. Registering Organizer Account...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('WeddingPass2026!', salt);
  const [userInsert] = await query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Sophia Taylor', `organizer_${Date.now()}@weddingmoments.com`, passwordHash, 'organizer']
  );
  const organizerId = userInsert.insertId;
  assert(organizerId > 0, 'Organizer should be created with valid ID');
  console.log(`   ✅ Organizer created with ID: ${organizerId}`);

  // 3. Create Wedding Event
  console.log('2. Creating Wedding Event ("John & Maria\'s Wedding")...');
  const publicId = `WED-2026-TEST${Math.floor(1000 + Math.random() * 9000)}`;
  const [eventInsert] = await query(
    `INSERT INTO events (
      public_id, organizer_id, name, couple_names, description, event_date, 
      theme_color, is_uploads_enabled, privacy_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PUBLIC')`,
    [
      publicId,
      organizerId,
      "John & Maria's Wedding",
      'John & Maria',
      'Welcome to our special day! Snap all our candid moments.',
      '2026-06-20',
      '#C5A880'
    ]
  );
  const eventId = eventInsert.insertId;
  assert(eventId > 0, 'Event should be created with valid ID');
  console.log(`   ✅ Event created with ID: ${eventId}, Public ID: ${publicId}`);

  // 4. Generate QR Code for Table Sign
  console.log('3. Generating Table Sign QR Code...');
  const eventUrl = qrService.getEventUrl(publicId);
  const qrDataUrl = await qrService.generateDataURL(eventUrl, { color: '#C5A880' });
  assert(qrDataUrl.startsWith('data:image/png;base64,'), 'QR Code should be generated as PNG Data URL');
  console.log(`   ✅ QR Code generated for URL: ${eventUrl}`);

  // 5. Guest Uploads a Photo
  console.log('4. Simulating Guest Photo Upload...');
  const samplePhotoBuffer = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 197, g: 168, b: 128, alpha: 1 }
    }
  }).jpeg({ quality: 85 }).toBuffer();

  const photoFile = {
    buffer: samplePhotoBuffer,
    originalname: 'cake_cutting.jpg',
    mimetype: 'image/jpeg',
    size: samplePhotoBuffer.length
  };

  const processedPhoto = await mediaService.processAndSaveMedia(
    photoFile,
    eventId,
    'Bridesmaid Emily',
    'Cutting the gorgeous wedding cake! 🍰'
  );

  const [photoInsert] = await query(
    `INSERT INTO media (
      event_id, media_type, original_filename, stored_filename, storage_path, 
      thumbnail_path, mime_type, file_size, width, height, uploader_name, caption, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      eventId,
      processedPhoto.mediaType,
      processedPhoto.originalFilename,
      processedPhoto.storedFilename,
      processedPhoto.storagePath,
      processedPhoto.thumbnailPath,
      processedPhoto.mimeType,
      processedPhoto.fileSize,
      processedPhoto.width,
      processedPhoto.height,
      processedPhoto.uploaderName,
      processedPhoto.caption
    ]
  );
  assert(photoInsert.insertId > 0, 'Photo should be inserted into media table');
  console.log(`   ✅ Guest photo processed & saved. Media ID: ${photoInsert.insertId}`);

  // 6. Guest Posts a Wedding Wish
  console.log('5. Simulating Guestbook Message Submission...');
  const [msgInsert] = await query(
    `INSERT INTO messages (event_id, guest_name, message, status) VALUES (?, ?, ?, 'visible')`,
    [eventId, 'Uncle Robert', 'Congratulations John and Maria! Wishing you endless joy and adventures together.']
  );
  assert(msgInsert.insertId > 0, 'Message should be saved into messages table');
  console.log(`   ✅ Guestbook message saved. Message ID: ${msgInsert.insertId}`);

  // 7. Verify Shared Album & Guestbook Queries
  console.log('6. Verifying Shared Album & Guestbook Data...');
  const [albumMedia] = await query('SELECT * FROM media WHERE event_id = ? AND status = "active"', [eventId]);
  assert.strictEqual(albumMedia.length, 1, 'Album should contain 1 photo');
  assert.strictEqual(albumMedia[0].uploader_name, 'Bridesmaid Emily');

  const [messages] = await query('SELECT * FROM messages WHERE event_id = ? AND status = "visible"', [eventId]);
  assert.strictEqual(messages.length, 1, 'Guestbook should contain 1 message');
  assert.strictEqual(messages[0].guest_name, 'Uncle Robert');
  console.log('   ✅ Album and Guestbook records verified.');

  // 8. Verify Dashboard Statistics
  console.log('7. Verifying Dashboard Statistics Aggregation...');
  const [stats] = await query(
    `SELECT 
      COUNT(id) as total_media,
      SUM(CASE WHEN media_type = 'photo' THEN 1 ELSE 0 END) as total_photos,
      SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) as total_videos
     FROM media WHERE event_id = ? AND status = 'active'`,
    [eventId]
  );
  assert.strictEqual(parseInt(stats[0].total_photos, 10), 1, 'Total photos count should be 1');
  assert.strictEqual(parseInt(stats[0].total_videos, 10), 0, 'Total videos count should be 0');
  console.log(`   ✅ Dashboard stats: ${stats[0].total_photos} photo(s), ${stats[0].total_videos} video(s).`);

  // Cleanup test media files
  await storageService.deleteFile(processedPhoto.storagePath);
  await storageService.deleteFile(processedPhoto.thumbnailPath);

  console.log('\n========================================================');
  console.log('🎉 ALL END-TO-END FLOW TESTS COMPLETED SUCCESSFULLY! ✨');
  console.log('========================================================\n');
}

runE2ETests().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
