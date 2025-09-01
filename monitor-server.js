#!/usr/bin/env node

/**
 * Script di monitoraggio per il server API
 * Verifica lo stato del server e risolve problemi comuni
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🔍 Monitoraggio Server API DemosApp\n');

// Funzione per testare la connessione HTTP
function testServerConnection(port = 3001) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      console.log(`✅ Server risponde sulla porta ${port} - Status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(`❌ Server non risponde sulla porta ${port}: ${err.message}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log(`⏰ Timeout connessione porta ${port}`);
      req.destroy();
      resolve(false);
    });
  });
}

// Funzione per avviare il server
function startServer() {
  console.log('🚀 Avvio server API...');
  
  const server = spawn('npm', ['start'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', (data) => {
    console.log(`📡 Server: ${data.toString().trim()}`);
  });

  server.stderr.on('data', (data) => {
    console.log(`⚠️  Server Error: ${data.toString().trim()}`);
  });

  server.on('close', (code) => {
    console.log(`🔚 Server terminato con codice: ${code}`);
  });

  return server;
}

// Funzione principale
async function monitorServer() {
  console.log('1. 🔍 Verifica stato attuale del server...');
  
  const isRunning = await testServerConnection(3001);
  
  if (!isRunning) {
    console.log('\n2. 🚀 Server non in esecuzione, avvio...');
    const server = startServer();
    
    // Attendi 5 secondi per l'avvio
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n3. 🔍 Verifica avvio server...');
    const isNowRunning = await testServerConnection(3001);
    
    if (isNowRunning) {
      console.log('\n✅ Server avviato con successo!');
      console.log('🌐 API disponibile su: http://localhost:3001');
      console.log('📊 Health check: http://localhost:3001/api/health');
    } else {
      console.log('\n❌ Problema nell\'avvio del server');
      console.log('💡 Controlla i log per errori specifici');
    }
  } else {
    console.log('\n✅ Server già in esecuzione!');
  }

  console.log('\n📋 Comandi utili:');
  console.log('   - Test API: curl http://localhost:3001/api/health');
  console.log('   - Stop server: Ctrl+C');
  console.log('   - Logs: npm run dev (per sviluppo)');
}

// Gestione interruzione
process.on('SIGINT', () => {
  console.log('\n🛑 Interruzione monitoraggio...');
  process.exit(0);
});

// Avvia monitoraggio
monitorServer().catch(console.error);
