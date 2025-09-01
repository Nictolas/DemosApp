const app = require('./app');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni`);
});

// Gestione errori di porta in uso
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Errore: Porta ${PORT} già in uso`);
    console.log('💡 Soluzioni:');
    console.log('   1. Termina il processo esistente');
    console.log('   2. Cambia la porta con: PORT=3002 npm start');
    console.log('   3. Riavvia il sistema');
    process.exit(1);
  } else {
    console.error('❌ Errore server:', err);
    process.exit(1);
  }
});

// Gestione chiusura graceful
process.on('SIGTERM', () => {
  console.log('🛑 Ricevuto SIGTERM, chiusura graceful...');
  server.close(() => {
    console.log('✅ Server chiuso correttamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Ricevuto SIGINT, chiusura graceful...');
  server.close(() => {
    console.log('✅ Server chiuso correttamente');
    process.exit(0);
  });
});
