const express = require('express');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const app = express();
const PORT = process.env.PORT || 4001;
const context = { redis };

// Register tools here
const tools = [
  require('./tools/zipcode')
];

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

// Initialize tools
async function initializeTools() {
  const configuredTools = [];

  for (const tool of tools) {
    if (tool.init) {
      console.log(`Initializing tool: ${tool.name}`);
      await tool.init(context);
    }
    configuredTools.push({
      name: tool.name,
      router: tool.router(context)
    });
  }

  return configuredTools;
}

// Start server after initializing tools
initializeTools().then(configuredTools => {
  const apiRouter = require('./routes/api')(configuredTools);
  app.use('/api', apiRouter);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize tools:', err);
  process.exit(1);
});
