const app = require('./app');
const net = require('net');

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Funzione per verificare se la porta è disponibile
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

// Funzione per avviare il server
async function startServer() {
  console.log(`🔍 Verifica disponibilità porta ${PORT}...`);
  
  const portAvailable = await isPortAvailable(PORT);
  
  if (!portAvailable && isProduction) {
    console.log(`⚠️  Porta ${PORT} non disponibile, attendo 3 secondi...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const portAvailableRetry = await isPortAvailable(PORT);
    if (!portAvailableRetry) {
      console.log('✅ Un altro processo ha già avviato il server');
      console.log('💡 Uscita graceful per evitare conflitti');
      process.exit(0);
    }
  }
  
  if (!portAvailable && !isProduction) {
    console.error(`❌ Errore: Porta ${PORT} già in uso`);
    console.log('💡 Soluzioni:');
    console.log('   1. Termina il processo esistente');
    console.log('   2. Cambia la porta con: PORT=3002 npm start');
    console.log('   3. Riavvia il sistema');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server avviato sulla porta ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni`);
  });

  // Gestione errori
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && isProduction) {
      console.log('✅ Un altro processo ha già avviato il server');
      process.exit(0);
    } else {
      console.error('❌ Errore server:', err);
      process.exit(1);
    }
  });

  return server;
}

// Avvia il server
startServer().then(server => {
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
}).catch(console.error);
