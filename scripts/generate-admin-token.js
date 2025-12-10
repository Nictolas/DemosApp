// Script per generare un token JWT admin per test/migrazione
// Uso: node scripts/generate-admin-token.js [user-id] [email]

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { generateTokenPair } = require('../api/utils/jwt');

// Se non viene passato user-id, usa valori di default per admin
const userId = process.argv[2] || 'admin-migration-token';
const email = process.argv[3] || 'admin@demos.community';

const tokenPayload = {
  userId: userId,
  email: email,
  role: 'Admin', // Ruolo admin
  nome: 'Admin',
  cognome: 'Migration'
};

const tokens = generateTokenPair(tokenPayload);

console.log('\n🔑 Token JWT Admin generato:\n');
console.log('='.repeat(60));
console.log('ACCESS TOKEN (usa questo per le API):');
console.log('='.repeat(60));
console.log(tokens.accessToken);
console.log('='.repeat(60));
console.log('\n💡 Copia il token sopra e usalo nell\'header Authorization:');
console.log('   Authorization: Bearer ' + tokens.accessToken.substring(0, 50) + '...');
console.log('\n📋 Esempio curl:');
console.log(`curl -X POST "https://demos-c7k0.onrender.com/api/admin/axiom-migration/migrate" \\`);
console.log(`  -H "Authorization: Bearer ${tokens.accessToken}" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"tables": ["centralized_logs", "audit_logs"], "dryRun": false}'`);
console.log('\n⚠️  NOTA: Questo token è valido per 24 ore');
console.log('⚠️  Per un token permanente, fai login come admin e copia il token dalla risposta\n');

