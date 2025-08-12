// API semplificata per Vercel
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API funzionante' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint funzionante' });
});

// Endpoint utenti semplificato
app.get('/api/utenti/me', (req, res) => {
  res.json({ message: 'Endpoint utenti funzionante', user: 'test' });
});

// Gestione route non trovate
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trovata' });
});

module.exports = app;