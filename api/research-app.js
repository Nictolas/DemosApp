const express = require('express');
const shadowConfig = require('./config/privacyResearchShadow');

// IMPORTANT: this process intentionally does NOT import the normal Demos JWT/auth
// middleware or DATABASE_URL pool. Future Research endpoints authenticate a
// participant cryptographically, not through an account session.
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'demos-research-shadow',
    mode: shadowConfig.mode,
    enabled: shadowConfig.enabled
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

module.exports = app;
