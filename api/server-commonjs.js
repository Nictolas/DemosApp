// Server DEMOS - CommonJS Version
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// === AGGIUNTO ===
// Importa le nuove rotte per l'amnistia
const amnistiaRoutes = require('./amnistia.js'); 

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'DEMOS Backend PostgreSQL is running (CommonJS)',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT,
    nodeVersion: process.version
  });
});

// === AGGIUNTO ===
// Attiva le rotte per l'amnistia. Tutte le richieste a /api/amnistia
// verranno gestite dal file amnistia.js
app.use('/api/amnistia', amnistiaRoutes);


// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`DEMOS Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Node version: ${process.version}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});

module.exports = app;