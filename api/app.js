const express = require('express');
const cors = require('cors');
const path = require('path');

// Import moduli
const healthRoutes = require('./routes/health');
const emailRoutes = require('./routes/email');
const databaseRoutes = require('./routes/database');
const compatibilityRoutes = require('./routes/compatibility');
const servicesRoutes = require('./routes/services');
const authRoutes = require('./routes/auth/index');
const userRoutes = require('./routes/users/index');
const opinioniRoutes = require('./routes/opinioni/index');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use(cors({
  origin: ['https://www.demos.community', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Route di base
app.use('/api', healthRoutes);

// Route per email e registrazione
app.use('/api', emailRoutes);

// Route per database
app.use('/api', databaseRoutes);

// Route per compatibilità frontend
app.use('/api', compatibilityRoutes);

// Route per servizi
app.use('/api', servicesRoutes);

// Route modulari
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/opinioni', opinioniRoutes);

// Gestione errori 404
app.use('*', (req, res) => {
  console.log(`❌ Route non trovata: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route non trovata',
    message: `La route ${req.method} ${req.originalUrl} non esiste`
  });
});

// Middleware gestione errori globale
app.use((error, req, res, next) => {
  console.error('💥 Errore globale:', error);
  res.status(500).json({
    success: false,
    error: 'Errore interno del server',
    message: 'Si è verificato un errore imprevisto'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni`);
});

module.exports = app;
