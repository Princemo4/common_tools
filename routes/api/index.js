const express = require('express');
const router = express.Router();

module.exports = (redis, namespace) => {
  router.get('/zipcode/:zipcode', async (req, res) => {
    const zipcode = req.params.zipcode;
    const data = await redis.get(`${namespace}${zipcode}`);
    if (!data) return res.send(false);
    res.json(JSON.parse(data));
  });
  return router;
};

