const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const IMAGES_DIR = path.join(__dirname, 'images');
const TEST_FILE = 'image.png';

/**
 * Utility for making POST requests with JSON body
 */
async function postRequest(endpoint, body) {
  return new Promise((resolve) => {
    const dataString = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          console.log(`[POST] ${endpoint}: Status ${res.statusCode}`);
          resolve(parsed);
        } catch (e) {
          console.log(`[POST] ${endpoint}: Status ${res.statusCode} (Raw response)`);
          resolve(responseBody);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[POST Error] ${endpoint}:`, err.message);
      resolve(null);
    });

    req.write(dataString);
    req.end();
  });
}

/**
 * Utility for making GET requests (including those with content-type json body if needed)
 */
async function getRequest(endpoint, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: endpoint,
      method: 'GET',
    };

    let dataString = '';
    if (body) {
      dataString = JSON.stringify(body);
      options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
      };
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          console.log(`[GET] ${endpoint}: Status ${res.statusCode}`);
          resolve(parsed);
        } catch (e) {
          console.log(`[GET] ${endpoint}: Status ${res.statusCode} (Non-JSON or Binary)`);
          resolve({ status: res.statusCode, contentType: res.headers['content-type'] });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[GET Error] ${endpoint}:`, err.message);
      resolve(null);
    });

    if (body) {
      req.write(dataString);
    }
    req.end();
  });
}

/**
 * Upload an image using multipart form-data
 */
async function uploadImage(filename) {
  return new Promise((resolve) => {
    const filePath = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return resolve(null);
    }

    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/images/upload',
      method: 'POST',
      headers: form.getHeaders(),
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[Upload] ${filename}: Status ${res.statusCode}`);
          resolve(parsed);
        } catch (e) {
          console.log(`[Upload] ${filename}: Status ${res.statusCode} (Raw)`, data);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[Upload Error] ${filename}:`, err.message);
      resolve(null);
    });

    form.pipe(req);
  });
}

async function run() {
  console.log('--- Starting Comprehensive API Test ---');
  
  // 1. Upload an image to get an ID
  console.log('\n1. Testing POST /images/upload...');
  const uploadResult = await uploadImage(TEST_FILE);
  const imageId = uploadResult?.id;

  // 2. High level gets
  console.log('\n2. Testing High-level GETs...');
  await getRequest('/images');
  await getRequest('/images/stats');
  await getRequest('/images/people/all');
  await getRequest('/images/relationships/all');
  await getRequest('/images/events/all');

  // 3. ID based gets
  if (imageId) {
    console.log(`\n3. Testing GETs for Image ID: ${imageId}...`);
    await getRequest(`/images/${imageId}`);
    await getRequest(`/images/${imageId}/file`);
  } else {
    console.log('\n3. Skipping ID-based tests due to upload failure.');
  }

  // 4. Person based gets (get first person if possible)
  console.log('\n4. Testing Person-based GETs...');
  const people = await getRequest('/images/people/all');
  if (Array.isArray(people) && people.length > 0) {
    const personId = people[0].id;
    console.log(`Testing with Person ID: ${personId}`);
    await getRequest(`/images/people/${personId}`);
    await getRequest(`/images/relationships/person/${personId}`);
    await getRequest(`/images/people/${personId}/mood-history`);
  } else {
    console.log('No people found to test person-based endpoints.');
  }

  // 5. Search endpoints
  console.log('\n5. Testing Search GETs (with body)...');
  await getRequest('/images/search', { query: 'person' });
  await getRequest('/images/search-by-text', { text: 'Happy person' });

  // 6. Backend query
  console.log('\n6. Testing POST /backend/query...');
  await postRequest('/backend/query', { query: 'Who is in the image?' });

  console.log('\n--- API Test Complete ---');
}

run().catch(err => console.error('Test Execution Error:', err));
