const express = require('express');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const readline = require('readline');
const stream = require('stream');
const cors = require('cors');
require('dotenv').config();

const ZIPCODE_FILE_URL = process.env.ZIPCODE_FILE_URL;
const REDIS_NAMESPACE = 'zipcodes::';
const REDIS_MIN_RECORDS = 1000;

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors(
  {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: false
  }
));

// Rate limiter middleware
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
});
app.use(limiter);

// Helper to get all keys in namespace
async function getNamespaceKeys(namespace) {
  let keys = [];
  let cursor = '0';
  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', `${namespace}*`, 'COUNT', 1000);
    keys = keys.concat(foundKeys);
    cursor = nextCursor;
  } while (cursor !== '0');
  return keys;
}

// Helper to delete all keys in namespace
async function deleteNamespace(namespace) {
  const keys = await getNamespaceKeys(namespace);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Helper to load zipcodes from file into Redis
async function loadZipcodesToRedis(url, namespace) {
  try {
    const res = await fetch(url);
    const tempFile = './zipcodes_temp.txt';
    const fileStream = fs.createWriteStream(tempFile);
    if (!res.ok || !res.body) throw new Error('Failed to fetch zipcode file');
    // Convert web stream to Node.js stream and pipe
    await new Promise((resolve, reject) => {
      stream.Readable.fromWeb(res.body).pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    const rl = readline.createInterface({
      input: fs.createReadStream(tempFile),
      crlfDelay: Infinity
    });

    const pipeline = redis.pipeline();
    let count = 0;
    for await (const line of rl) {
      if (!line.trim() || line.startsWith('#')) continue;
      const [country, postal, place, admin1, code1, admin2, code2, admin3, code3, lat, lng, accuracy] = line.split('\t');
      const data = {
        country_code: country, postal, city: place, state: admin1, state_code: code1, county: admin2, county_code: code2, lat, lng, accuracy
      };
      pipeline.set(`${namespace}${postal}`, JSON.stringify(data));
      count++;
      if (count % 1000 === 0) await pipeline.exec();
    }
    await pipeline.exec();
    fs.unlinkSync(tempFile);
  } catch (error) {
    console.error('Failed to load zipcodes:', error);
    throw error;
  }
}

// On startup, check and load zipcodes if needed
async function ensureZipcodesLoaded() {
  const keys = await getNamespaceKeys(REDIS_NAMESPACE);
  if (keys.length < REDIS_MIN_RECORDS) {
    await deleteNamespace(REDIS_NAMESPACE);
    await loadZipcodesToRedis(ZIPCODE_FILE_URL, REDIS_NAMESPACE);
  }
}

const apiRouter = require('./routes/api')(redis, REDIS_NAMESPACE);
app.use('/api', apiRouter);

// Start server after ensuring zipcodes are loaded
ensureZipcodesLoaded().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize zipcodes:', err);
  process.exit(1);
});
