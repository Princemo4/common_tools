const fs = require('fs');
const readline = require('readline');
const stream = require('stream');
const express = require('express');

const ZIPCODE_FILE_URL = process.env.ZIPCODE_FILE_URL;
const REDIS_NAMESPACE = 'zipcodes::';
const REDIS_MIN_RECORDS = 1000;

async function getNamespaceKeys(redis, namespace) {
  let keys = [];
  let cursor = '0';
  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', `${namespace}*`, 'COUNT', 1000);
    keys = keys.concat(foundKeys);
    cursor = nextCursor;
  } while (cursor !== '0');
  return keys;
}

async function deleteNamespace(redis, namespace) {
  const keys = await getNamespaceKeys(redis, namespace);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

async function loadZipcodesToRedis(redis, url, namespace) {
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

module.exports = {
  name: 'zipcode',
  init: async ({ redis }) => {
    const keys = await getNamespaceKeys(redis, REDIS_NAMESPACE);
    if (keys.length < REDIS_MIN_RECORDS) {
      console.log('Loading zipcodes into Redis...');
      await deleteNamespace(redis, REDIS_NAMESPACE);
      await loadZipcodesToRedis(redis, ZIPCODE_FILE_URL, REDIS_NAMESPACE);
      console.log('Zipcodes loaded.');
    }
  },
  router: ({ redis }) => {
    const router = express.Router();
    router.get('/:zipcode', async (req, res) => {
      const zipcode = req.params.zipcode;
      const data = await redis.get(`${REDIS_NAMESPACE}${zipcode}`);
      if (!data) return res.send(false);
      res.json(JSON.parse(data));
    });
    return router;
  }
};
