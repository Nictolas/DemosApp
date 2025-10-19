const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// POST /api/attivisti/vote - Vota per un attivista
router.post('/vote', async (req, res) => {
  try {
    const { codice_attivista, grado } = req.body;
    const userId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🗳️ POST /api/attivisti/vote - Voto attivista', { codice_attivista, grado, userId });
    
    if (!codice_attivista || !grado) {
      return res.status(400).json({
        success: false,
        error: 'Parametri mancanti',
        message: 'Codice attivista e grado sono obbligatori'
      });
    }
    
    // Valida il grado
    const validGradi = ['europeo', 'camera', 'senato', 'regionale', 'comune'];
    if (!validGradi.includes(grado)) {
      return res.status(400).json({
        success: false,
        error: 'Grado non valido',
        message: 'Il grado deve essere uno di: europeo, camera, senato, regionale, comune'
      });
    }
    
    // Trova l'attivista dal codice
    const attivistaQuery = `
      SELECT id, nome, cognome, codice_attivista
      FROM users 
      WHERE codice_attivista = $1 AND ruolo IN ('A', 'AD') AND status = 'a'
    `;
    
    const attivistaResult = await pool.query(attivistaQuery, [codice_attivista]);
    
    if (attivistaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Attivista non trovato',
        message: `Nessun attivista trovato con codice ${codice_attivista}`
      });
    }
    
    const attivista = attivistaResult.rows[0];
    
    // Mappa il grado al campo del database
    const campoMapping = {
      'europeo': 'rappresentante_europeo',
      'camera': 'rappresentante_camera',
      'senato': 'rappresentante_senato',
      'regionale': 'rappresentante_regionale',
      'comune': 'rappresentante_comune'
    };
    
    const campo = campoMapping[grado];
    
    // Aggiorna il voto dell'utente
    const updateQuery = `
      UPDATE users 
      SET ${campo} = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await pool.query(updateQuery, [attivista.id, userId]);
    
    console.log(`✅ Voto registrato: ${userId} → ${attivista.nome} ${attivista.cognome} (${grado})`);
    
    res.json({
      success: true,
      message: `Voto registrato per ${attivista.nome} ${attivista.cognome}`,
      data: {
        attivista: {
          codice: attivista.codice_attivista,
          nome: attivista.nome,
          cognome: attivista.cognome
        },
        grado: grado
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel voto attivista:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile registrare il voto'
    });
  }
});

// GET /api/attivisti/vote - Ottieni i voti dell'utente
router.get('/vote', async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log('🔍 GET /api/attivisti/vote - Voti utente', { userId });
    
    const votesQuery = `
      SELECT 
        rappresentante_europeo,
        rappresentante_camera,
        rappresentante_senato,
        rappresentante_regionale,
        rappresentante_comune
      FROM users 
      WHERE id = $1
    `;
    
    const votesResult = await pool.query(votesQuery, [userId]);
    
    if (votesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const votes = votesResult.rows[0];
    
    // Ottieni i dettagli degli attivisti votati
    const attivistiVotati = [];
    
    for (const [grado, attivistaId] of Object.entries(votes)) {
      if (attivistaId) {
        const attivistaQuery = `
          SELECT codice_attivista, nome, cognome
          FROM users 
          WHERE id = $1
        `;
        
        const attivistaResult = await pool.query(attivistaQuery, [attivistaId]);
        
        if (attivistaResult.rows.length > 0) {
          const attivista = attivistaResult.rows[0];
          attivistiVotati.push({
            grado: grado.replace('rappresentante_', ''),
            codice: attivista.codice_attivista,
            nome: attivista.nome,
            cognome: attivista.cognome
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: attivistiVotati,
      count: attivistiVotati.length
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero voti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i voti'
    });
  }
});

module.exports = router;
