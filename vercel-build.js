const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniziando build Vercel...');

try {
  // 1. Installa dipendenze root
  console.log('📦 Installando dipendenze root...');
  execSync('npm install', { stdio: 'inherit' });
  
  // 2. Installa dipendenze client
  console.log('📦 Installando dipendenze client...');
  execSync('cd client && npm install', { stdio: 'inherit' });
  
  // 3. Build del frontend
  console.log('🔨 Building frontend...');
  execSync('cd client && npm run build', { stdio: 'inherit' });
  
  // 4. Verifica che il build sia stato creato
  const distPath = path.join(__dirname, 'client', 'dist');
  if (fs.existsSync(distPath)) {
    console.log('✅ Build completato con successo!');
    console.log(`📁 Output directory: ${distPath}`);
    
    // Lista i file generati
    const files = fs.readdirSync(distPath);
    console.log('📄 File generati:', files);
  } else {
    throw new Error('Build directory non trovata!');
  }
  
} catch (error) {
  console.error('❌ Errore durante il build:', error.message);
  process.exit(1);
}
