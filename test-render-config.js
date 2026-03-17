#!/usr/bin/env node

/**
 * Script di test per la configurazione Render
 * Simula l'ambiente di produzione Render
 */

const { spawn } = require('child_process');

console.log('🧪 Test Configurazione Render\n');

// Simula l'ambiente Render
const renderEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '10000'  // Porta tipica di Render
};

console.log('📋 Ambiente simulato:');
console.log(`   NODE_ENV: ${renderEnv.NODE_ENV}`);
console.log(`   PORT: ${renderEnv.PORT}`);

console.log('\n🚀 Avvio server in modalità Render...');

const server = spawn('npm', ['start'], {
  cwd: './api',
  env: renderEnv,
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  const output = data.toString().trim();
  console.log(`📡 Server: ${output}`);
  
  // Verifica che il server si avvii correttamente
  if (output.includes('Server avviato sulla porta')) {
    console.log('✅ Server avviato correttamente!');
  }
  
  if (output.includes('Ambiente: production')) {
    console.log('✅ Ambiente produzione rilevato!');
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString().trim();
  console.log(`⚠️  Server Error: ${output}`);
  
  // Verifica che non ci siano errori di porta in uso
  if (output.includes('EADDRINUSE')) {
    console.log('❌ Errore porta in uso rilevato!');
  }
});

server.on('close', (code) => {
  console.log(`\n🔚 Server terminato con codice: ${code}`);
  
  if (code === 0) {
    console.log('✅ Test completato con successo!');
  } else {
    console.log('❌ Test fallito!');
  }
});

// Termina il test dopo 10 secondi
setTimeout(() => {
  console.log('\n⏰ Terminazione test dopo 10 secondi...');
  server.kill('SIGTERM');
}, 10000);

// Gestione interruzione
process.on('SIGINT', () => {
  console.log('\n🛑 Interruzione test...');
  server.kill('SIGTERM');
  process.exit(0);
});
