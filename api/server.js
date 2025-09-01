const app = require('./app');

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

const server = app.listen(PORT, () => {
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni`);
});

// Gestione errori semplificata
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    if (isProduction) {
      console.log(`✅ Un altro processo ha già avviato il server sulla porta ${PORT}`);
      console.log('💡 Uscita graceful per evitare conflitti');
      process.exit(0); // Exit gracefully in produzione
    } else {
      console.error(`❌ Errore: Porta ${PORT} già in uso`);
      console.log('💡 Soluzioni:');
      console.log('   1. Termina il processo esistente');
      console.log('   2. Cambia la porta con: PORT=3002 npm start');
      console.log('   3. Riavvia il sistema');
      process.exit(1);
    }
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
