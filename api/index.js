// api/index.js
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
 
// Import backend modules
const config = require('../backend/src/config');         
const availabilityRouter = require('../backend/src/routes/availability');
 
const app = express();
app.use(cors());
app.use(express.json());
 
// Routes 
app.use('/availability', availabilityRouter);
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});
 

const handler = serverless(app);
module.exports = (req, res) => handler(req, res);