#!/usr/bin/env node

/**
 * Test per l'integrazione CIE
 * Verifica che tutti i componenti siano configurati correttamente
 */

const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testCIEIntegration() {
  console.log('🧪 Test integrazione CIE - DemosApp\n');
  
  try {
    // 1. Test connessione database
    console.log('1️⃣ Test connessione database...');
    const client = await pool.connect();
    console.log('✅ Connessione database OK');
    
    // 2. Test colonne CIE
    console.log('\n2️⃣ Test colonne CIE...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('auth_method', 'verified', 'data_nascita', 'sesso', 'luogo_nascita')
      ORDER BY column_name
    `);
    
    const expectedColumns = ['auth_method', 'verified', 'data_nascita', 'sesso', 'luogo_nascita'];
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    console.log('📋 Colonne trovate:', existingColumns);
    
    for (const col of expectedColumns) {
      if (existingColumns.includes(col)) {
        console.log(`✅ Colonna ${col} presente`);
      } else {
        console.log(`❌ Colonna ${col} mancante`);
      }
    }
    
    // 3. Test indici
    console.log('\n3️⃣ Test indici CIE...');
    const indexesResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname LIKE '%auth_method%' OR indexname LIKE '%verified%'
    `);
    
    console.log('📊 Indici trovati:', indexesResult.rows.length);
    indexesResult.rows.forEach(row => {
      console.log(`✅ Indice: ${row.indexname}`);
    });
    
    // 4. Test provider CIE
    console.log('\n4️⃣ Test provider CIE...');
    try {
      const { CIEProvider } = require('./providers/cie-provider.js');
      const provider = CIEProvider();
      
      if (provider.id === 'cie' && provider.name.includes('CIE')) {
        console.log('✅ Provider CIE configurato correttamente');
        console.log(`   - ID: ${provider.id}`);
        console.log(`   - Nome: ${provider.name}`);
        console.log(`   - Tipo: ${provider.type}`);
      } else {
        console.log('❌ Provider CIE non configurato correttamente');
      }
    } catch (error) {
      console.log('❌ Errore nel caricamento provider CIE:', error.message);
    }
    
    // 5. Test configurazione Auth.js
    console.log('\n5️⃣ Test configurazione Auth.js...');
    try {
      const { authOptions } = require('./auth-config.js');
      
      const cieProvider = authOptions.providers.find(p => p.id === 'cie');
      if (cieProvider) {
        console.log('✅ Provider CIE integrato in Auth.js');
        console.log(`   - Client ID configurato: ${!!cieProvider.clientId}`);
        console.log(`   - Client Secret configurato: ${!!cieProvider.clientSecret}`);
      } else {
        console.log('❌ Provider CIE non trovato in Auth.js');
      }
    } catch (error) {
      console.log('❌ Errore nel caricamento Auth.js:', error.message);
    }
    
    // 6. Test variabili d'ambiente
    console.log('\n6️⃣ Test variabili d\'ambiente...');
    const envVars = [
      'CIE_CLIENT_ID',
      'CIE_CLIENT_SECRET', 
      'CIE_AUTHORIZATION_URL',
      'CIE_TOKEN_URL',
      'CIE_USERINFO_URL',
      'CIE_CALLBACK_URL',
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET'
    ];
    
    envVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`✅ ${varName}: configurata`);
      } else {
        console.log(`⚠️  ${varName}: non configurata`);
      }
    });
    
    // 7. Test componenti frontend
    console.log('\n7️⃣ Test componenti frontend...');
    const fs = require('fs');
    const path = require('path');
    
    const frontendFiles = [
      'client/src/components/CIEButton.tsx',
      'client/src/pages/auth-page-cie.tsx'
    ];
    
    frontendFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file}: presente`);
      } else {
        console.log(`❌ ${file}: mancante`);
      }
    });
    
    // 8. Test inserimento utente CIE
    console.log('\n8️⃣ Test inserimento utente CIE...');
    // Genera un UUID semplice per il test
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    
    const testUser = {
      id: generateUUID(),
      email: 'test-cie@example.com',
      nome: 'Test',
      cognome: 'CIE',
      codice_fiscale: 'TSTCIE80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      auth_method: 'cie',
      verified: true
    };
    
    try {
      await client.query(`
        INSERT INTO users (
          id, email, nome, cognome, codice_fiscale, 
          data_nascita, sesso, auth_method, verified, status, ruolo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        testUser.id,
        testUser.email,
        testUser.nome,
        testUser.cognome,
        testUser.codice_fiscale,
        testUser.data_nascita,
        testUser.sesso,
        testUser.auth_method,
        testUser.verified,
        'approved',
        'user'
      ]);
      
      console.log('✅ Inserimento utente CIE test riuscito');
      
      // Pulisci test user
      await client.query('DELETE FROM users WHERE id = $1', [testUser.id]);
      console.log('🧹 Utente test rimosso');
      
    } catch (error) {
      console.log('❌ Errore inserimento utente CIE:', error.message);
    }
    
    client.release();
    
    console.log('\n🎉 Test integrazione CIE completato!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. Configura le variabili d\'ambiente CIE');
    console.log('2. Registrati come Service Provider presso AgID');
    console.log('3. Testa l\'autenticazione CIE in produzione');
    console.log('4. Aggiorna la UI per utilizzare auth-page-cie.tsx');
    
  } catch (error) {
    console.error('💥 Errore durante il test:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui test
testCIEIntegration()
  .then(() => {
    console.log('\n✅ Test completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test fallito:', error);
    process.exit(1);
  });
