const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Database diagnostics must be explicitly opted into on local development only.
// A production ALLOW_DEV_API_SURFACE override must never expose SQL metadata.
const enableDbDiagnostics = process.env.NODE_ENV === 'development' &&
  process.env.ALLOW_DB_DIAGNOSTICS === 'true';


// Endpoint per verificare la struttura della tabella users
if (enableDbDiagnostics) {
router.get('/check-table-structure', async (req, res) => {
  try {
    console.log('🔍 Verificando struttura tabella users...');
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_URL mancante',
        message: 'Variabile d\'ambiente non configurata'
      });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // 1. Verifica esistenza tabella
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      await pool.end();
      return res.status(404).json({
        success: false,
        error: 'Tabella non trovata',
        message: 'La tabella "users" non esiste nel database'
      });
    }

    // 2. Ottieni struttura completa della tabella
    const structure = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    // 3. Verifica campi specifici per la registrazione
    const requiredFields = [
      'email', 'password_hash', 'nome', 'cognome', 'genere', 
      'data_nascita', 'cittadinanza', 'paese_residenza', 
      'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'ruolo', 'grado_elezione', 'paese_elezione', 'regione_elezione',
      'provincia_elezione', 'comune_elezione', 'grado_candidatura',
      'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'status', 'created_at', 'updated_at'
    ];

    const existingColumns = structure.rows.map(row => row.column_name);
    const missingFields = requiredFields.filter(field => !existingColumns.includes(field));
    const extraFields = existingColumns.filter(col => !requiredFields.includes(col));

    await pool.end();

    res.json({
      success: true,
      message: 'Struttura tabella verificata',
      tableExists: true,
      totalColumns: structure.rows.length,
      structure: structure.rows,
      requiredFields: {
        total: requiredFields.length,
        existing: requiredFields.filter(field => existingColumns.includes(field)),
        missing: missingFields
      },
      extraFields: extraFields,
      criticalFields: {
        data_nascita: structure.rows.find(row => row.column_name === 'data_nascita')?.data_type || 'MISSING',
        created_at: structure.rows.find(row => row.column_name === 'created_at')?.data_type || 'MISSING',
        updated_at: structure.rows.find(row => row.column_name === 'updated_at')?.data_type || 'MISSING'
      }
    });

  } catch (error) {
    console.error('💥 Errore durante la verifica struttura:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la verifica',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

}

module.exports = router;
