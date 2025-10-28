// api/index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});
// Alias for Vercel function path
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

// Test route
app.get('/test', (_req, res) => {
  res.json({ message: 'API test route working' });
});

// Debug route to test POST
app.post('/debug', (req, res) => {
  res.json({ 
    message: 'Debug POST route working',
    body: req.body,
    headers: req.headers['content-type']
  });
});

// Try to import and mount availability routes
try {
  const availabilityRouter = require('./backend/routes/availability');
  app.use('/availability', availabilityRouter);
  // Alias for Vercel function path
  app.use('/api/availability', availabilityRouter);
  console.log('✅ Availability routes loaded successfully');
} catch (error) {
  console.log('❌ Error loading availability routes:', error.message);
  // Add a fallback route to show the error
  app.get('/availability/error', (_req, res) => {
    res.json({ error: 'Availability routes failed to load', details: error.message });
  });
}

module.exports = app;