const express = require('express');

module.exports = tools => {
  const router = express.Router();

  tools.forEach(tool => {
    // Each tool gets its own path under /api.
    router.use(`/${tool.name}`, tool.router);
  });

  return router;
};
