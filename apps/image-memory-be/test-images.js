const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const IMAGES_DIR = path.join(__dirname, 'images');
const FILES = ['image-1.png', 'image-2.png', 'image-3.png', 'image.png'];

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
          console.log(`[Upload] ${filename}: Status ${res.statusCode}`, parsed);
          resolve(parsed);
        } catch (e) {
          console.log(`[Upload] ${filename}: Status ${res.statusCode} (Raw)`, data);
          resolve({ status: res.statusCode, raw: data });
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

async function getRequest(endpoint) {
  return new Promise((resolve) => {
    http.get(`${BASE_URL}${endpoint}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[GET] ${endpoint}:`, Array.isArray(parsed) ? `${parsed.length} items` : 'Object');
          resolve(parsed);
        } catch (e) {
          console.log(`[GET] ${endpoint}: Raw content`);
          resolve(data);
        }
      });
    }).on('error', (err) => {
      console.error(`[GET Error] ${endpoint}:`, err.message);
      resolve(null);
    });
  });
}

async function run() {
  console.log('--- Starting Image Pipeline Test ---');
  
  // 1. Upload all images
  for (const file of FILES) {
    await uploadImage(file);
  }

  // 2. Call all relevant APIs
  console.log('\n--- Fetching Data ---');
  const results = {
    images: await getRequest('/images'),
    stats: await getRequest('/images/stats'),
    people: await getRequest('/images/people/all'),
    relationships: await getRequest('/images/relationships/all'),
    events: await getRequest('/images/events/all'),
  };

  // 3. Save findings
  fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
  console.log('\n--- Test Complete ---');
  console.log('Detailed results saved to test-results.json');
}

run();
