const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Supporto per richieste OPTIONS (preflight)
router.options('/check-email', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

// Endpoint per controllare se un'email esiste già
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email richiesta',
        message: 'Il campo email è obbligatorio'
      });
    }

    console.log('🔍 Controllo email nel database:', email);
    console.log('🌍 Ambiente:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL presente:', !!process.env.DATABASE_URL);

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL mancante!');
      return res.status(500).json({
        success: false,
        error: 'Configurazione database mancante',
        message: 'Variabile DATABASE_URL non configurata'
      });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('🔌 Pool database creato, tentativo connessione...');

    // Test connessione
    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    client.release();

    // Controlla se l'email esiste nella tabella users
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const exists = result.rows.length > 0;
    console.log('📊 Email trovata nel database:', exists, 'Righe:', result.rows.length);
    console.log('📊 Query result:', result.rows);

    const response = { exists };
    console.log('📤 Invio risposta:', response);
    res.json(response);

    // Chiudi la connessione DOPO aver inviato la risposta
    await pool.end();

  } catch (error) {
    console.error('💥 Errore durante il controllo email:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    // Assicurati che la risposta sia sempre JSON valido
    try {
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        message: 'Impossibile verificare l\'email',
        exists: false,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } catch (jsonError) {
      console.error('❌ Errore nel serializzare JSON:', jsonError);
      res.status(500).send('{"success":false,"error":"Errore interno","exists":false}');
    }
  }
});

// Endpoint di registrazione rimosso - ora gestito da /api/auth/register

module.exports = router;
