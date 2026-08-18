const assert = require('assert');
const sharp = require('sharp');

async function testMultipartUpload() {
  const BASE_URL = 'http://localhost:3000';
  console.log('\n📸 ========================================================');
  console.log('🧪 Testing Live Media Multipart Upload via HTTP API');
  console.log('========================================================\n');

  // 1. Create a test user & event
  const regEmail = `uploader_test_${Date.now()}@wedding.com`;
  const regBody = new URLSearchParams({
    name: 'Jessica Miller',
    email: regEmail,
    password: 'Password123!',
    confirmPassword: 'Password123!'
  });

  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: regBody,
    redirect: 'manual'
  });
  const cookieHeader = regRes.headers.get('set-cookie').split(';')[0];

  const eventBody = new URLSearchParams({
    name: 'Jessica & David Wedding',
    couple_names: 'Jessica & David',
    event_date: '2026-07-14',
    theme_color: '#C5A880',
    privacy_mode: 'PUBLIC'
  });

  const createEventRes = await fetch(`${BASE_URL}/admin/events/create`, {
    method: 'POST',
    headers: { 'Cookie': cookieHeader },
    body: eventBody,
    redirect: 'manual'
  });

  const location = createEventRes.headers.get('location');
  const publicId = location.match(/\/admin\/events\/([^/]+)\/qr/)[1];
  console.log(`1. Created Event for Upload Test: /e/${publicId}`);

  // 2. Generate a valid test image buffer using Sharp
  const testImageBuffer = await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 212, g: 175, b: 55, alpha: 1 }
    }
  }).jpeg({ quality: 90 }).toBuffer();

  // 3. Upload photo using FormData
  console.log('2. Uploading photo via POST /e/:publicId/upload...');
  const formData = new FormData();
  const fileBlob = new Blob([testImageBuffer], { type: 'image/jpeg' });
  formData.append('media', fileBlob, 'champagne_toast.jpg');
  formData.append('guest_name', 'Best Man Luke');
  formData.append('caption', 'A toast to the wonderful couple! 🥂');

  const uploadRes = await fetch(`${BASE_URL}/e/${publicId}/upload`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: formData
  });

  assert.strictEqual(uploadRes.status, 201, 'Upload should return 201 Created');
  const uploadData = await uploadRes.json();
  assert.strictEqual(uploadData.success, true, 'Upload response should be success');
  assert(uploadData.media && uploadData.media.length === 1, 'Should return 1 uploaded media record');
  console.log(`   ✅ Photo uploaded successfully! URL: ${uploadData.media[0].url}`);
  console.log(`   ✅ WebP Thumbnail generated! URL: ${uploadData.media[0].thumbnailUrl}`);

  // 4. Verify media appears in GET /api/events/:publicId/media
  console.log('3. Testing GET /api/events/:publicId/media...');
  const mediaApiRes = await fetch(`${BASE_URL}/api/events/${publicId}/media`);
  const mediaApiData = await mediaApiRes.json();
  assert.strictEqual(mediaApiData.success, true);
  assert.strictEqual(mediaApiData.data.length, 1);
  assert.strictEqual(mediaApiData.data[0].uploader_name, 'Best Man Luke');
  console.log('   ✅ Media REST API verified.');

  // 5. Test Batch ZIP download endpoint
  console.log('4. Testing GET /admin/events/:publicId/download-all (ZIP export)...');
  const zipRes = await fetch(`${BASE_URL}/admin/events/${publicId}/download-all`, {
    headers: { 'Cookie': cookieHeader }
  });
  assert.strictEqual(zipRes.status, 200, 'ZIP download should return 200 OK');
  assert.strictEqual(zipRes.headers.get('content-type'), 'application/zip', 'Content-Type should be application/zip');
  const zipBuffer = await zipRes.arrayBuffer();
  assert(zipBuffer.byteLength > 100, 'ZIP buffer should contain archived bytes');
  console.log(`   ✅ ZIP download generated (${zipBuffer.byteLength} bytes).`);

  console.log('\n========================================================');
  console.log('🎉 ALL MULTIPART & ZIP LIVE TESTS PASSED! ✨');
  console.log('========================================================\n');
}

testMultipartUpload().catch((err) => {
  console.error('Multipart Upload Test Failed:', err);
  process.exit(1);
});
