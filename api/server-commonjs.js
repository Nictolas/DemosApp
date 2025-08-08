// Server DEMOS - CommonJS Version
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// === INIZIO AGGIORNAMENTO: Importa tutte le rotte ===
const amnistiaRoutes = require('./amnistia.js');
const elezioniRoutes = require('./elezioni.js');
const capoStatoRoutes = require('./capo-stato.js');
const governoRoutes = require('./governo.js');
const graziaRoutes = require('./grazia.js');
const iceRoutes = require('./ice.js');
const iniziativePopolariRoutes = require('./iniziative-popolari.js');
const referendumAbrogativiRoutes = require('./referendum-abrogativi.js');
const programmaRoutes = require('./programma.js');
const comunicazioniRoutes = require('./comunicazioni.js');
const notificheRoutes = require('./notifiche.js');
const sondaggiRoutes = require('./sondaggi.js');
const statisticheRoutes = require('./statistiche.js');
const sostenitoriRoutes = require('./sostenitori.js');
const userRoutes = require('./users.js'); // Assumendo che esista o che lo creerai
// === FINE AGGIORNAMENTO ===

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
  });
});

// === INIZIO AGGIORNAMENTO: Attiva tutte le rotte ===
app.use('/api/amnistia', amnistiaRoutes);
app.use('/api/elezioni', elezioniRoutes);
app.use('/api/capo-stato', capoStatoRoutes);
app.use('/api/governo', governoRoutes);
app.use('/api/grazia', graziaRoutes);
app.use('/api/ice', iceRoutes);
app.use('/api/iniziative-popolari', iniziativePopolariRoutes);
app..use('/api/referendum-abrogativi', referendumAbrogativiRoutes);
app.use('/api/programma', programmaRoutes);
app.use('/api/comunicazioni', comunicazioniRoutes);
app.use('/api/notifiche', notificheRoutes);
app.use('/api/sondaggi', sondaggiRoutes);
app.use('/api/statistiche', statisticheRoutes);
app.use('/api/sostenitori', sostenitoriRoutes);
app.use('/api/utenti', userRoutes);
// === FINE AGGIORNAMENTO ===

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
});

server.on('error', (error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});

module.exports = app;