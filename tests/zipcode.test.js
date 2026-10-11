const assert = require('assert');
const zipcodeTool = require('../tools/zipcode');

async function testZipcodeModule() {
  console.log('Testing zipcode tool module interface...');
  
  assert.strictEqual(zipcodeTool.name, 'zipcode', 'Tool name should be "zipcode"');
  assert.strictEqual(typeof zipcodeTool.init, 'function', 'Tool should have an init function');
  assert.strictEqual(typeof zipcodeTool.router, 'function', 'Tool should have a router function');

  const context = { redis: {} };
  assert.ok(zipcodeTool.router(context), 'Router should accept a dependency context');
  
  console.log('Zipcode tool module interface test passed.');
}

testZipcodeModule().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
