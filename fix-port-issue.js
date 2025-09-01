#!/usr/bin/env node

/**
 * Script per risolvere il problema di porta in uso
 * Verifica e termina processi che potrebbero occupare la porta 10000
 */

const { exec } = require('child_process');
const os = require('os');

console.log('🔧 Risoluzione problema porta in uso...\n');

// Funzione per eseguire comandi
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ Errore: ${error.message}`);
        resolve(null);
        return;
      }
      if (stderr) {
        console.log(`⚠️  Warning: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

async function fixPortIssue() {
  console.log('1. 🔍 Verifica processi sulla porta 10000...');
  
  // Su Windows
  if (os.platform() === 'win32') {
    const netstatOutput = await runCommand('netstat -ano | findstr :10000');
    if (netstatOutput && netstatOutput.trim()) {
      console.log('📋 Processi trovati sulla porta 10000:');
      console.log(netstatOutput);
      
      // Estrai PID e termina processo
      const lines = netstatOutput.split('\n');
      for (const line of lines) {
        if (line.includes(':10000')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            console.log(`🔄 Terminando processo PID: ${pid}`);
            await runCommand(`taskkill /PID ${pid} /F`);
          }
        }
      }
    } else {
      console.log('✅ Nessun processo trovato sulla porta 10000');
    }
  } else {
    // Su Linux/Mac
    const lsofOutput = await runCommand('lsof -ti:10000');
    if (lsofOutput && lsofOutput.trim()) {
      const pids = lsofOutput.trim().split('\n');
      console.log(`📋 Processi trovati sulla porta 10000: ${pids.join(', ')}`);
      
      for (const pid of pids) {
        if (pid) {
          console.log(`🔄 Terminando processo PID: ${pid}`);
          await runCommand(`kill -9 ${pid}`);
        }
      }
    } else {
      console.log('✅ Nessun processo trovato sulla porta 10000');
    }
  }

  console.log('\n2. 🔍 Verifica processi Node.js...');
  const nodeProcesses = await runCommand('tasklist | findstr node.exe');
  if (nodeProcesses && nodeProcesses.trim()) {
    console.log('📋 Processi Node.js trovati:');
    console.log(nodeProcesses);
  } else {
    console.log('✅ Nessun processo Node.js trovato');
  }

  console.log('\n3. 🔧 Verifica variabili d\'ambiente...');
  console.log(`PORT: ${process.env.PORT || 'Non impostata'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Non impostata'}`);

  console.log('\n4. ✅ Risoluzione completata!');
  console.log('💡 Suggerimenti:');
  console.log('   - Se il problema persiste, riavvia il sistema');
  console.log('   - Verifica che non ci siano altri servizi sulla porta 10000');
  console.log('   - Controlla le variabili d\'ambiente PORT');
}

// Esegui la risoluzione
fixPortIssue().catch(console.error);
