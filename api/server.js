let app;
try {
  console.log('📦 Caricamento app.js...');
  app = require('./app');
  console.log('✅ app.js caricato correttamente');
} catch (error) {
  console.error('❌ Errore critico nel caricamento di app.js:', error);
  console.error('❌ Stack trace:', error.stack);
  process.exit(1);
}

// Inizializza Firebase Admin all'avvio per verificare la configurazione
try {
  console.log('🔥 Inizializzazione Firebase Admin all\'avvio...');
  const { initializeFirebaseAdmin } = require('./services/firebaseAdmin');
  const admin = initializeFirebaseAdmin();
  if (admin) {
    console.log('✅ Firebase Admin inizializzato correttamente all\'avvio');
  } else {
    console.warn('⚠️ Firebase Admin non inizializzato - verifica le variabili d\'ambiente su Render.com');
  }
} catch (error) {
  console.error('❌ Errore nell\'inizializzazione Firebase Admin all\'avvio:', error.message);
  console.error('❌ Stack:', error.stack);
}

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

let server;
try {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server avviato sulla porta ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni, governo, governo-ministro, rappresentanti, notifiche`);
  });
} catch (error) {
  console.error('❌ Errore critico nell\'avvio del server:', error);
  console.error('❌ Stack trace:', error.stack);
  process.exit(1);
}

// Gestione errori semplificata
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    if (isProduction) {
      console.log(`⚠️  Porta ${PORT} già in uso, ma continuo a servire richieste`);
      console.log('💡 Render può avere istanze multiple, questo è normale');
      // Non uscire in produzione, lascia che Render gestisca le istanze
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

// Gestione errori non catturati
process.on('uncaughtException', (error) => {
  console.error('❌ Errore non catturato (uncaughtException):', error);
  console.error('❌ Stack trace:', error.stack);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rifiutata non gestita (unhandledRejection):', reason);
  console.error('❌ Promise:', promise);
  if (reason && reason.stack) {
    console.error('❌ Stack trace:', reason.stack);
  }
});

// Gestione chiusura graceful
process.on('SIGTERM', () => {
  console.log('🛑 Ricevuto SIGTERM, chiusura graceful...');
  if (server) {
    server.close(() => {
      console.log('✅ Server chiuso correttamente');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('🛑 Ricevuto SIGINT, chiusura graceful...');
  if (server) {
    server.close(() => {
      console.log('✅ Server chiuso correttamente');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
