const assert = require('assert');

async function testHttpEndpoints() {
  const BASE_URL = 'http://localhost:3000';
  console.log('\n🌐 ========================================================');
  console.log('🧪 Testing Live Express HTTP Server at ' + BASE_URL);
  console.log('========================================================\n');

  // 1. Test Homepage
  console.log('1. Testing GET / (Landing Page)...');
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.strictEqual(homeRes.status, 200, 'Homepage should return 200 OK');
  const homeHtml = await homeRes.text();
  assert(homeHtml.includes('Digital Disposable Camera'), 'Home HTML should contain app title');
  console.log('   ✅ Homepage loaded successfully (Status 200)');

  // 2. Test Register Page
  console.log('2. Testing GET /auth/register...');
  const regPageRes = await fetch(`${BASE_URL}/auth/register`);
  assert.strictEqual(regPageRes.status, 200, 'Register page should return 200 OK');
  console.log('   ✅ Register page loaded successfully');

  // 3. Test Registration POST
  console.log('3. Testing POST /auth/register...');
  const regEmail = `organizer_http_${Date.now()}@wedding.com`;
  const regBody = new URLSearchParams({
    name: 'Emily Davis',
    email: regEmail,
    password: 'Password123!',
    confirmPassword: 'Password123!'
  });

  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: regBody,
    redirect: 'manual'
  });

  assert([302, 303].includes(regRes.status), `Registration should redirect (Status: ${regRes.status})`);
  const setCookie = regRes.headers.get('set-cookie');
  assert(setCookie, 'Registration should set session cookie');
  const cookieHeader = setCookie.split(';')[0];
  console.log('   ✅ Organizer registered & authenticated with session cookie.');

  // 4. Test Event Creation POST
  console.log('4. Testing POST /admin/events/create...');
  const eventBody = new URLSearchParams({
    name: "John & Maria's Wedding",
    couple_names: 'John & Maria',
    event_date: '2026-06-28',
    description: 'Welcome to our wedding! Please snap candid photos of all the joy.',
    theme_color: '#C5A880',
    privacy_mode: 'PUBLIC'
  });

  const createEventRes = await fetch(`${BASE_URL}/admin/events/create`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader
    },
    body: eventBody,
    redirect: 'manual'
  });

  assert([302, 303].includes(createEventRes.status), 'Event creation should redirect to QR view');
  const redirectLocation = createEventRes.headers.get('location');
  assert(redirectLocation && redirectLocation.includes('/qr'), `Redirect should point to QR page (${redirectLocation})`);
  
  const publicIdMatch = redirectLocation.match(/\/admin\/events\/([^/]+)\/qr/);
  const publicId = publicIdMatch ? publicIdMatch[1] : null;
  assert(publicId, 'Public ID should be extracted from redirect location');
  console.log(`   ✅ Event created! Public ID: ${publicId}`);

  // 5. Test Printable QR Table Sign
  console.log(`5. Testing GET /admin/events/${publicId}/qr...`);
  const qrRes = await fetch(`${BASE_URL}/admin/events/${publicId}/qr`, {
    headers: { 'Cookie': cookieHeader }
  });
  assert.strictEqual(qrRes.status, 200, 'QR page should return 200 OK');
  const qrHtml = await qrRes.text();
  assert(qrHtml.includes('Scan to be our disposable camera'), 'QR page should contain table sign prompt');
  assert(qrHtml.includes('data:image/png;base64,'), 'QR page should contain base64 QR code');
  console.log('   ✅ Printable Table QR Sign generated with high-res PNG.');

  // 6. Test Guest Event Landing Page
  console.log(`6. Testing GET /e/${publicId} (Guest Mobile View)...`);
  const guestRes = await fetch(`${BASE_URL}/e/${publicId}`);
  assert.strictEqual(guestRes.status, 200, 'Guest page should return 200 OK');
  const guestHtml = await guestRes.text();
  assert(guestHtml.includes('Take Photo / Video'), 'Guest page should render Take Photo / Video button');
  assert(guestHtml.includes('Upload Media'), 'Guest page should render Upload Media button');
  assert(guestHtml.includes('View Album'), 'Guest page should render View Album button');
  assert(guestHtml.includes('Leave a Message'), 'Guest page should render Leave a Message button');
  console.log('   ✅ Guest Mobile Hub rendered perfectly with all 4 tactile actions.');

  // 7. Test Guestbook Message POST via JSON API
  console.log(`7. Testing POST /e/${publicId}/messages (Guestbook API)...`);
  const msgRes = await fetch(`${BASE_URL}/e/${publicId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      guest_name: 'Uncle David & Aunt Clara',
      message: 'So incredibly happy for you both! May your journey be filled with laughter and everlasting love. 🥂💍'
    })
  });

  assert.strictEqual(msgRes.status, 201, 'Message post should return 201 Created');
  const msgData = await msgRes.json();
  assert.strictEqual(msgData.success, true, 'Response should indicate success');
  console.log('   ✅ Guestbook message submitted and stored.');

  // 8. Test Shared Album Page
  console.log(`8. Testing GET /e/${publicId}/album...`);
  const albumRes = await fetch(`${BASE_URL}/e/${publicId}/album`);
  assert.strictEqual(albumRes.status, 200, 'Album page should return 200 OK');
  const albumHtml = await albumRes.text();
  assert(albumHtml.includes('Shared Wedding Album'), 'Album should contain heading');
  console.log('   ✅ Shared Album page verified.');

  // 9. Test Guestbook Page
  console.log(`9. Testing GET /e/${publicId}/guestbook...`);
  const gbRes = await fetch(`${BASE_URL}/e/${publicId}/guestbook`);
  assert.strictEqual(gbRes.status, 200, 'Guestbook page should return 200 OK');
  const gbHtml = await gbRes.text();
  assert(gbHtml.includes('Uncle David &amp; Aunt Clara') || gbHtml.includes('Uncle David & Aunt Clara'), 'Guest message should appear on guestbook wall');
  console.log('   ✅ Guestbook wall rendered with submitted wish.');

  // 10. Test Admin Dashboard
  console.log('10. Testing GET /admin/dashboard...');
  const dashRes = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { 'Cookie': cookieHeader }
  });
  assert.strictEqual(dashRes.status, 200, 'Admin dashboard should return 200 OK');
  const dashHtml = await dashRes.text();
  assert(dashHtml.includes('Guest Wishes'), 'Dashboard should display Guest Wishes metric card');
  console.log('   ✅ Admin Dashboard verified with live metrics.');

  console.log('\n========================================================');
  console.log('🎉 10/10 LIVE HTTP INTEGRATION TESTS PASSED PERFECTLY! ✨');
  console.log('========================================================\n');
}

testHttpEndpoints().catch((err) => {
  console.error('HTTP Test Failed:', err);
  process.exit(1);
});
