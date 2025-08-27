const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniziando build per Vercel...');

try {
  // 1. Verifica che siamo nella directory corretta
  console.log('📁 Directory corrente:', process.cwd());
  
  // 2. Installa dipendenze del server
  console.log('📦 Installando dipendenze server...');
  execSync('npm install', { stdio: 'inherit' });
  
  // 3. Installa dipendenze del client
  console.log('📦 Installando dipendenze client...');
  execSync('cd client && npm install', { stdio: 'inherit' });
  
  // 4. Esegui build del client
  console.log('🔨 Buildando client...');
  execSync('cd client && npm run build', { stdio: 'inherit' });
  
  // 5. Verifica che il build sia stato creato
  const distPath = path.join(process.cwd(), 'client', 'dist');
  if (fs.existsSync(distPath)) {
    console.log('✅ Build completato con successo!');
    console.log('📁 Output directory:', distPath);
    
    // Lista i file generati
    const files = fs.readdirSync(distPath);
    console.log('📋 File generati:', files);
  } else {
    throw new Error('Directory dist non trovata dopo il build');
  }
  
} catch (error) {
  console.error('❌ Errore durante il build:', error.message);
  process.exit(1);
}
