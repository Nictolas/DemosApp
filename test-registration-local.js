const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Simula l'ambiente di produzione
process.env.NODE_ENV = 'production';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL mancante. Impostala come variabile d’ambiente prima di eseguire questo test.');
}

async function testRegistration() {
  try {
    console.log('🧪 TEST REGISTRAZIONE LOCALE - Identifico il problema...\n');

    // 1. Test connessione database
    console.log('1️⃣ Test connessione database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    client.release();

    // 2. Test hash password
    console.log('\n2️⃣ Test hash password...');
    const password = 'Test123!';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('✅ Password hashata con successo:', passwordHash.substring(0, 20) + '...');

    // 3. Test conversione data
    console.log('\n3️⃣ Test conversione data...');
    const data_nascita = '15/08/1990';
    let dataNascitaConvertita = null;
    
    if (data_nascita && data_nascita.trim() !== '') {
      try {
        console.log('📅 Tentativo conversione data:', data_nascita);
        
        // Verifica formato DD/MM/YYYY
        const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const match = data_nascita.match(dateRegex);
        
        if (match) {
          const [, giorno, mese, anno] = match;
          
          // Validazione valori
          const giornoNum = parseInt(giorno);
          const meseNum = parseInt(mese);
          const annoNum = parseInt(anno);
          
          if (giornoNum >= 1 && giornoNum <= 31 && 
              meseNum >= 1 && meseNum <= 12 && 
              annoNum >= 1900 && annoNum <= 2100) {
            
            dataNascitaConvertita = `${annoNum}-${meseNum.toString().padStart(2, '0')}-${giornoNum.toString().padStart(2, '0')}`;
            console.log('✅ Data di nascita convertita con successo:', data_nascita, '→', dataNascitaConvertita);
          } else {
            console.warn('⚠️ Valori data fuori range:', { giorno: giornoNum, mese: meseNum, anno: annoNum });
          }
        } else {
          console.warn('⚠️ Formato data non valido (atteso DD/MM/YYYY):', data_nascita);
        }
      } catch (error) {
        console.error('❌ Errore critico conversione data:', error);
        console.error('📋 Stack trace conversione:', error.stack);
      }
    }
    
    console.log('📅 Data finale per database:', dataNascitaConvertita || 'NULL (nessuna data)');

    // 4. Test query di inserimento (solo preparazione, senza eseguire)
    console.log('\n4️⃣ Test preparazione query di inserimento...');
    const insertQuery = `
      INSERT INTO users (
        email, password_hash, nome, cognome, genere, data_nascita, cittadinanza,
        paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
        ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
        grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING id, email, nome, cognome
    `;

    const insertValues = [
      'test-local@example.com', passwordHash, 'Test', 'Local', null, dataNascitaConvertita, null,
      null, null, null, null,
      'elettore', null, null, null, null, null,
      null, null, null, null, null,
      'pending', new Date(), new Date()
    ];

    console.log('✅ Query preparata correttamente');
    console.log('📝 Valori preparati:', insertValues.length, 'parametri');

    // 5. Test generazione JWT
    console.log('\n5️⃣ Test generazione JWT...');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { 
        userId: 'test-id',
        email: 'test-local@example.com',
        ruolo: 'elettore'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('✅ Token JWT generato:', token.substring(0, 20) + '...');

    // 6. Test finale - verifica che tutto sia pronto
    console.log('\n🎯 TEST COMPLETATO - Tutto sembra funzionare localmente!');
    console.log('📋 Problema potrebbe essere:');
    console.log('   - Variabili d\'ambiente su Render');
    console.log('   - Conflitti di versione Node.js');
    console.log('   - Problemi di memoria/CPU su Render');
    console.log('   - Timeout delle richieste');

  } catch (error) {
    console.error('💥 Errore durante il test:', error);
    console.error('📋 Stack trace completo:', error.stack);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Esegui il test
testRegistration().catch(console.error);
