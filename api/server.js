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
  
  // In produzione, fai exit per evitare memory leaks e stato inconsistente
  // In sviluppo, continua per permettere il debugging
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICO: UnhandledRejection in produzione - chiusura graceful del server');
    if (server) {
      server.close(() => {
        console.error('❌ Server chiuso dopo unhandledRejection');
        process.exit(1);
      });
      // Timeout di sicurezza: se il server non si chiude entro 10 secondi, forza l'exit
      setTimeout(() => {
        console.error('❌ Timeout chiusura server - forza exit');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(1);
    }
  } else {
    console.warn('⚠️ UnhandledRejection in sviluppo - continuo per debugging');
  }
});

// Funzione per cleanup graceful di tutti i servizi
const gracefulShutdown = async () => {
  console.log('🛑 Avvio shutdown graceful...');
  
  try {
    // Ferma performance optimizer
    try {
      const performanceOptimizer = require('./services/performanceOptimizer');
      if (performanceOptimizer && typeof performanceOptimizer.stop === 'function') {
        performanceOptimizer.stop();
        console.log('✅ Performance optimizer fermato');
      }
    } catch (error) {
      console.error('⚠️ Errore fermando performance optimizer:', error.message);
    }
    
    // Ferma performance monitor
    try {
      const performanceMonitor = require('./services/performanceMonitor');
      if (performanceMonitor && typeof performanceMonitor.stop === 'function') {
        performanceMonitor.stop();
        console.log('✅ Performance monitor fermato');
      }
    } catch (error) {
      console.error('⚠️ Errore fermando performance monitor:', error.message);
    }
    
    // Ferma security monitoring
    try {
      const { stopSecurityMonitoring } = require('./middleware/securityMonitoring');
      if (stopSecurityMonitoring && typeof stopSecurityMonitoring === 'function') {
        stopSecurityMonitoring();
        console.log('✅ Security monitoring fermato');
      }
    } catch (error) {
      console.error('⚠️ Errore fermando security monitoring:', error.message);
    }
    
    // Chiudi pool database
    try {
      const { closePool } = require('./config/database');
      if (closePool && typeof closePool === 'function') {
        await closePool();
        console.log('✅ Pool database chiuso');
      }
    } catch (error) {
      console.error('⚠️ Errore chiudendo pool database:', error.message);
    }
    
    console.log('✅ Cleanup completato');
  } catch (error) {
    console.error('❌ Errore durante cleanup graceful:', error);
  }
};

// Gestione chiusura graceful
process.on('SIGTERM', async () => {
  console.log('🛑 Ricevuto SIGTERM, chiusura graceful...');
  await gracefulShutdown();
  if (server) {
    server.close(() => {
      console.log('✅ Server chiuso correttamente');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 Ricevuto SIGINT, chiusura graceful...');
  await gracefulShutdown();
  if (server) {
    server.close(() => {
      console.log('✅ Server chiuso correttamente');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
