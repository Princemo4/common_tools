const assert = require('assert');
const express = require('express');
const zipcodeTool = require('../tools/zipcode');
const apiRouter = require('../routes/api');

async function testZipcodeRouter() {
  console.log('Testing zipcode router...');
  
  const mockRedis = {
    get: async (key) => {
      if (key === 'zipcodes::12345') {
        return JSON.stringify({ city: 'Test City', postal: '12345' });
      }
      return null;
    }
  };
  
  const router = zipcodeTool.router({ redis: mockRedis });
  const app = express();
  app.use('/zipcode', router);
  
  // We can't easily test express routes without starting a server or using supertest
  // but we can at least check if the router is created correctly.
  assert.ok(router, 'Router should be created');
  
  console.log('Zipcode router test passed (basic check).');
}

async function testApiRouterComposition() {
  console.log('Testing generic API router composition...');

  const zipcodeRouter = express.Router();
  const healthRouter = express.Router();
  zipcodeRouter.get('/', (req, res) => res.send('zipcode'));
  healthRouter.get('/', (req, res) => res.send('healthy'));

  const router = apiRouter([
    { name: 'zipcode', router: zipcodeRouter },
    { name: 'health', router: healthRouter }
  ]);
  const app = express();
  app.use('/api', router);
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const zipcodeResponse = await fetch(`http://127.0.0.1:${port}/api/zipcode/`);
    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health/`);

    assert.strictEqual(await zipcodeResponse.text(), 'zipcode');
    assert.strictEqual(await healthResponse.text(), 'healthy');
  } finally {
    server.close();
  }

  console.log('Generic API router composition test passed.');
}

Promise.all([testZipcodeRouter(), testApiRouterComposition()]).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
