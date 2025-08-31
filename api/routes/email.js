const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

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

    // Chiudi la connessione
    await pool.end();

    const response = { exists };
    console.log('📤 Invio risposta:', response);
    res.json(response);

  } catch (error) {
    console.error('💥 Errore durante il controllo email:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile verificare l\'email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint di registrazione utente
router.post('/register', async (req, res) => {
  try {
    console.log('🚀 REGISTRAZIONE INIZIATA - Ricevuta richiesta POST /api/register');
    console.log('📋 Headers ricevuti:', req.headers);
    console.log('📦 Body ricevuto:', JSON.stringify(req.body, null, 2));
    
    const { email, password, nome, cognome, genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza, ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura } = req.body;

    // Validazione campi obbligatori
    if (!email || !password || !nome || !cognome) {
      console.log('❌ Validazione fallita - campi obbligatori mancanti');
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori mancanti',
        message: 'Email, password, nome e cognome sono obbligatori'
      });
    }

    console.log('✅ Validazione campi obbligatori superata');
    console.log('📝 REGISTRAZIONE - Tentativo registrazione per:', email);
    console.log('📋 Dati ricevuti:', { email, nome, cognome, genere, data_nascita, cittadinanza, ruolo });

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL mancante!');
      return res.status(500).json({
        success: false,
        error: 'Configurazione database mancante',
        message: 'Variabile DATABASE_URL non configurata'
      });
    }

    console.log('✅ DATABASE_URL configurata, creazione pool...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('🔌 Pool database creato, tentativo connessione...');

    // Test connessione
    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    client.release();

    // Hash della password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('🔐 Password hashata con successo');

    // Converti la data di nascita dal formato DD/MM/YYYY a YYYY-MM-DD
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
    
    // Log finale per debugging
    console.log('📅 Data finale per database:', dataNascitaConvertita || 'NULL (nessuna data)');

    // Inserisci l'utente nella tabella users
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
      email.toLowerCase(), passwordHash, nome, cognome, genere || null, dataNascitaConvertita, cittadinanza || null,
      paese_residenza || null, regione_residenza || null, provincia_residenza || null, comune_residenza || null,
      ruolo || 'elettore', grado_elezione || null, paese_elezione || null, regione_elezione || null, provincia_elezione || null, comune_elezione || null,
      grado_candidatura || null, paese_candidatura || null, regione_candidatura || null, provincia_candidatura || null, comune_candidatura || null,
      'pending', new Date(), new Date()
    ];

    console.log('📝 Eseguendo query di inserimento...');
    const result = await pool.query(insertQuery, insertValues);
    
    if (result.rows.length === 0) {
      throw new Error('Inserimento utente fallito');
    }

    const newUser = result.rows[0];
    console.log('✅ Utente registrato con successo:', newUser.email, 'ID:', newUser.id);

    // Chiudi la connessione
    await pool.end();

    // Genera token JWT
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    const token = jwt.sign(
      { 
        userId: newUser.id,
        email: newUser.email,
        ruolo: newUser.ruolo || 'elettore'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('🎫 Token JWT generato per utente:', newUser.email);

    res.json({
      success: true,
      message: 'Utente registrato con successo',
      user: {
        id: newUser.id,
        email: newUser.email,
        nome: newUser.nome,
        cognome: newUser.cognome,
        ruolo: newUser.ruolo || 'elettore'
      },
      token: token
    });

  } catch (error) {
    console.error('💥 Errore durante la registrazione:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile completare la registrazione',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
