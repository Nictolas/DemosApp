const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

// POST /api/migrate/columns - Crea colonne attivisti e organizzazioni
router.post('/columns', async (req, res) => {
  try {
    console.log('🚀 Inizio migrazione colonne...');
    
    // Controlla se la colonna attivisti esiste
    const checkAttivisti = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'attivisti'
    `);
    
    if (checkAttivisti.rows.length === 0) {
      console.log('📝 Creando colonna attivisti...');
      await pool.query(`
        ALTER TABLE users ADD COLUMN attivisti VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Colonna attivisti creata');
    } else {
      console.log('✅ Colonna attivisti esiste già');
    }
    
    // Controlla se la colonna organizzazioni esiste
    const checkOrganizzazioni = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'organizzazioni'
    `);
    
    if (checkOrganizzazioni.rows.length === 0) {
      console.log('📝 Creando colonna organizzazioni...');
      await pool.query(`
        ALTER TABLE users ADD COLUMN organizzazioni VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Colonna organizzazioni creata');
    } else {
      console.log('✅ Colonna organizzazioni esiste già');
    }
    
    // Verifica foreign keys
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni)
    `);
    
    console.log('🎉 Migrazione completata con successo!');
    
    res.json({
      success: true,
      message: 'Colonne create con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

