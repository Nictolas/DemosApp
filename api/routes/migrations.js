const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Endpoint temporaneo per aggiungere le colonne political_opinions_consent
// RIMUOVERE DOPO L'ESECUZIONE per sicurezza
router.post('/add-political-opinions-consent-columns', async (req, res) => {
  // Protezione: richiedi una chiave segreta (imposta come variabile d'ambiente)
  const migrationKey = req.headers['x-migration-key'] || req.body.migrationKey;
  const expectedKey = process.env.MIGRATION_SECRET_KEY || 'TEMPORARY_MIGRATION_KEY_CHANGE_ME';
  
  if (migrationKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Chiave di migrazione non valida'
    });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });

  try {
    console.log('🔧 Esecuzione migrazione: aggiunta colonne political_opinions_consent...');
    
    const client = await pool.connect();
    
    const columnsToAdd = [
      { name: 'political_opinions_consent', type: 'BOOLEAN DEFAULT false', description: 'Consenso esplicito per opinioni politiche (GDPR Art. 9)' },
      { name: 'political_opinions_consent_timestamp', type: 'TIMESTAMP WITH TIME ZONE', description: 'Data e ora del consenso' },
      { name: 'political_opinions_consent_ip_address', type: 'VARCHAR(45)', description: 'Indirizzo IP al momento del consenso' },
      { name: 'political_opinions_consent_user_agent', type: 'TEXT', description: 'User agent al momento del consenso' }
    ];
    
    const results = [];
    
    for (const column of columnsToAdd) {
      const columnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = $1
        );
      `, [column.name]);
      
      if (columnExists.rows[0].exists) {
        results.push({ column: column.name, status: 'exists', message: 'La colonna esiste già' });
        console.log(`✅ La colonna ${column.name} esiste già`);
      } else {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN ${column.name} ${column.type}
        `);
        results.push({ column: column.name, status: 'added', message: 'Colonna aggiunta con successo' });
        console.log(`✅ Colonna ${column.name} aggiunta con successo`);
      }
    }
    
    // Crea indice se non esiste
    const indexExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_political_opinions_consent'
      );
    `);
    
    if (!indexExists.rows[0].exists) {
      await client.query(`
        CREATE INDEX idx_users_political_opinions_consent 
        ON users(political_opinions_consent)
        WHERE political_opinions_consent = true
      `);
      results.push({ column: 'index', status: 'created', message: 'Indice creato' });
      console.log('✅ Indice su political_opinions_consent creato');
    } else {
      results.push({ column: 'index', status: 'exists', message: 'Indice esiste già' });
      console.log('✅ Indice su political_opinions_consent esiste già');
    }
    
    client.release();
    
    res.json({
      success: true,
      message: 'Migrazione completata con successo!',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Errore nella migrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella migrazione',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    await pool.end();
  }
});

module.exports = router;
