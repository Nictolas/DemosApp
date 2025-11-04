const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getPool } = require('../config/database');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Funzione per creare la tabella voti se non esiste
async function ensureVotiTableExists() {
  try {
    // Verifica che DATABASE_URL sia disponibile
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL non disponibile, salto la creazione della tabella voti');
      return;
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS voti_opinioni_proposte (
        id SERIAL PRIMARY KEY,
        utente_id UUID NOT NULL,
        opinione_id VARCHAR(255) NOT NULL,
        data_voto TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(utente_id, opinione_id)
      );
    `;
    
    await pool.query(createTableQuery);
    
    // Crea indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_voti_opinioni_utente_id 
      ON voti_opinioni_proposte(utente_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_voti_opinioni_opinione_id 
      ON voti_opinioni_proposte(opinione_id);
    `);
    
    console.log('✅ Tabella voti_opinioni_proposte verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella voti:', error);
    // Non bloccare l'avvio del server se c'è un errore nella creazione della tabella
  }
}

// Inizializza la tabella all'avvio (ritardata per assicurarsi che il pool sia pronto)
setTimeout(() => {
  ensureVotiTableExists().catch(err => {
    console.error('❌ Errore nell\'inizializzazione tabella voti:', err);
  });
}, 1000); // Attendi 1 secondo per assicurarsi che il pool sia inizializzato

// GET /api/opinioni-proposte/test-voto - Test endpoint per verificare inserimento voto
router.get('/test-voto', async (req, res) => {
  try {
    console.log('🧪 TEST - Test inserimento voto');
    
    // Test inserimento voto di prova
    const testUserId = 'test-user-id';
    const testOpinioneId = 'allevamenti_intensivi';
    
    console.log('🔍 Test parametri:', { testUserId, testOpinioneId });
    
    // Prima assicurati che la tabella esista
    await ensureVotiTableExists();
    
    // Prova inserimento
    const insertQuery = `
      INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
      VALUES ($1, $2)
      ON CONFLICT (utente_id, opinione_id) DO NOTHING
    `;
    
    const result = await pool.query(insertQuery, [testUserId, testOpinioneId]);
    console.log('📊 Risultato test inserimento:', result);
    
    // Verifica che il voto sia stato inserito
    const checkQuery = `
      SELECT * FROM voti_opinioni_proposte 
      WHERE utente_id = $1 AND opinione_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [testUserId, testOpinioneId]);
    console.log('🔍 Voto inserito:', checkResult.rows);
    
    res.json({
      success: true,
      test_inserted: result.rowCount > 0,
      vote_exists: checkResult.rows.length > 0,
      vote_data: checkResult.rows[0] || null
    });
    
  } catch (error) {
    console.error('❌ Errore nel test voto:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// GET /api/opinioni-proposte/debug - Debug endpoint per verificare database
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint opinioni-proposte chiamato');
    
    // Test connessione database
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connesso:', testQuery.rows[0].current_time);
    
    // Test tabella opinioni
    const opinioniCount = await pool.query('SELECT COUNT(*) as count FROM opinioni_domande');
    console.log('✅ Righe in opinioni:', opinioniCount.rows[0].count);
    
    // Test opinioni da approvare
    const daApprovareQuery = `
      SELECT COUNT(*) as count FROM opinioni_domande 
      WHERE 'da approvare' = ANY(gradi_opinione)
    `;
    const daApprovareCount = await pool.query(daApprovareQuery);
    console.log('✅ Righe da approvare:', daApprovareCount.rows[0].count);
    
    // Test tabella voti_opinioni_proposte
    let votiTableExists = false;
    let votiCount = 0;
    try {
      const votiCountQuery = await pool.query('SELECT COUNT(*) as count FROM voti_opinioni_proposte');
      votiTableExists = true;
      votiCount = votiCountQuery.rows[0].count;
      console.log('✅ Righe in voti_opinioni_proposte:', votiCount);
    } catch (error) {
      console.log('⚠️ Tabella voti_opinioni_proposte non esiste:', error.message);
    }
    
    // Test struttura tabella voti se esiste
    let votiStructure = [];
    if (votiTableExists) {
      try {
        const structureQuery = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'voti_opinioni_proposte'
          ORDER BY ordinal_position
        `;
        const structure = await pool.query(structureQuery);
        votiStructure = structure.rows;
        console.log('📋 Struttura tabella voti:', votiStructure);
      } catch (error) {
        console.log('⚠️ Errore nel recuperare struttura tabella voti:', error.message);
      }
    }
    
    res.json({
      success: true,
      database_connected: true,
      opinioni_count: opinioniCount.rows[0].count,
      da_approvare_count: daApprovareCount.rows[0].count,
      voti_table_exists: votiTableExists,
      voti_count: votiCount,
      voti_structure: votiStructure,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/opinioni-proposte/voti-utente - Ottieni voti dell'utente autenticato
router.get('/voti-utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('🔍 GET /api/opinioni-proposte/voti-utente - Voti utente:', userId);
    
    const query = `
      SELECT opinione_id 
      FROM voti_opinioni_proposte 
      WHERE utente_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    const votiUtente = result.rows.map(row => row.opinione_id);
    
    console.log(`✅ Trovati ${votiUtente.length} voti per utente ${userId}`);
    
    res.json({
      success: true,
      data: votiUtente
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare voti utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare voti utente',
      message: error.message
    });
  }
});

// GET /api/opinioni-proposte - Ottieni opinioni da approvare dalla tabella opinioni
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-proposte - Caricamento opinioni da approvare');
    
    // Query per ottenere le opinioni "da approvare" con conteggio voti
    const query = `
      SELECT 
        o.id, 
        o.text as testo, 
        o.gradi_opinione, 
        o.approfondimento,
        COALESCE(v.voti_count, 0) as voti
      FROM opinioni_domande o
      LEFT JOIN (
        SELECT opinione_id, COUNT(*) as voti_count
        FROM voti_opinioni_proposte
        GROUP BY opinione_id
      ) v ON o.id = v.opinione_id
      WHERE 'da approvare' = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    const result = await pool.query(query);
    console.log(`✅ Trovate ${result.rows.length} opinioni da approvare`);
    
    // Mappa i dati per compatibilità con il frontend
    const mappedData = result.rows.map(row => ({
      id: row.id,
      testo: row.testo,
      utente_id: null,
      titolo: null,
      descrizione: null,
      categoria: null,
      fonte: 'proposta',
      data_creazione: new Date().toISOString(),
      data_aggiornamento: new Date().toISOString(),
      nome: null,
      cognome: null,
      email: null,
      voti: parseInt(row.voti) // Conteggio voti reale
    }));
    
    res.json({
      success: true,
      data: mappedData
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni da approvare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni da approvare',
      message: error.message
    });
  }
});

// POST /api/opinioni-proposte - Crea una nuova opinione proposta nella tabella opinioni
router.post('/', async (req, res) => {
  try {
    console.log('📝 POST /api/opinioni-proposte - Creazione nuova opinione proposta');
    console.log('🔍 Body ricevuto:', req.body);
    console.log('🔍 Headers:', req.headers);
    
    const { testo, titolo, descrizione, categoria } = req.body;
    
    // Estrae userId dal token se presente
    let userId = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (error) {
        console.log('⚠️ Token non valido, continuo senza userId');
      }
    }
    
    console.log('🔍 Testo estratto:', testo);
    console.log('🔍 User ID:', userId);
    
    if (!testo || !testo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Testo dell\'opinione obbligatorio'
      });
    }
    
    // Genera ID univoco
    const id = require('crypto').randomUUID();
    
    // Inserisce nella tabella opinioni_domande con gradi_opinione contenente "da approvare"
    const insertQuery = `
      INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
      VALUES ($1, $2, $3, $4)
    `;
    
    const gradiOpinione = ['da approvare'];
    const approfondimento = `## Proposta da approvare\n\n${testo.trim()}`;
    
    await pool.query(insertQuery, [
      id,
      testo.trim(),
      gradiOpinione,
      approfondimento
    ]);
    
    console.log('✅ Opinione proposta creata con successo nella tabella opinioni:', id);
    
    // Se l'utente è autenticato, aggiungi automaticamente il suo voto
    if (userId) {
      try {
        const insertVoteQuery = `
          INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
          VALUES ($1, $2)
          ON CONFLICT (utente_id, opinione_id) DO NOTHING
        `;
        await pool.query(insertVoteQuery, [userId, id]);
        console.log(`✅ Voto automatico aggiunto per utente ${userId} su opinione ${id}`);
      } catch (error) {
        console.error('⚠️ Errore nell\'aggiungere voto automatico:', error);
        // Non bloccare l'operazione se il voto non può essere aggiunto
      }
    }
    
    res.json({
      success: true,
      message: 'Opinione proposta creata con successo',
      data: { id, testo: testo.trim() }
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione opinione proposta:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione opinione proposta',
      message: error.message
    });
  }
});

// POST /api/opinioni-proposte/:id/vota - Vota un'opinione proposta
router.post('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // User ID dall'autenticazione JWT
    
    console.log('👍 POST /api/opinioni-proposte/:id/vota - Voto opinione proposta');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Prima assicurati che la tabella voti esista
    await ensureVotiTableExists();
    
    // Verifica se l'opinione esiste nella tabella opinioni con "da approvare"
    const checkQuery = `
      SELECT id FROM opinioni_domande 
      WHERE id = $1 AND 'da approvare' = ANY(gradi_opinione)
    `;
    
    console.log('🔍 Verifica esistenza opinione...');
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Opinione non trovata o non in stato da approvare');
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    console.log('✅ Opinione trovata, procedo con il voto...');
    
    // Inserisci il voto nella tabella voti_opinioni_proposte
    const insertVotoQuery = `
      INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
      VALUES ($1, $2)
      ON CONFLICT (utente_id, opinione_id) DO NOTHING
    `;
    
    console.log('🔍 Inserimento voto con parametri:', { userId, id });
    const insertResult = await pool.query(insertVotoQuery, [userId, id]);
    console.log('📊 Risultato inserimento:', insertResult);
    
    console.log('✅ Voto registrato con successo per opinione:', id);
    
    res.json({
      success: true,
      message: 'Voto registrato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel voto:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel voto',
      message: error.message,
      details: error.stack
    });
  }
});

// DELETE /api/opinioni-proposte/:id/vota - Rimuovi voto da un'opinione proposta
router.delete('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // User ID dall'autenticazione JWT
    
    console.log('👎 DELETE /api/opinioni-proposte/:id/vota - Rimozione voto');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Prima assicurati che la tabella voti esista
    await ensureVotiTableExists();
    
    // Verifica se l'opinione esiste nella tabella opinioni con "da approvare"
    const checkQuery = `
      SELECT id FROM opinioni_domande 
      WHERE id = $1 AND 'da approvare' = ANY(gradi_opinione)
    `;
    
    console.log('🔍 Verifica esistenza opinione...');
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Opinione non trovata o non in stato da approvare');
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    console.log('✅ Opinione trovata, procedo con la rimozione del voto...');
    
    // Rimuovi il voto dalla tabella voti_opinioni_proposte
    const deleteVotoQuery = `
      DELETE FROM voti_opinioni_proposte 
      WHERE utente_id = $1 AND opinione_id = $2
    `;
    
    console.log('🔍 Rimozione voto...');
    const result = await pool.query(deleteVotoQuery, [userId, id]);
    console.log('📊 Righe rimosse:', result.rowCount);
    
    if (result.rowCount === 0) {
      console.log('❌ Voto non trovato');
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato'
      });
    }
    
    console.log('✅ Voto rimosso con successo per opinione:', id);
    
    res.json({
      success: true,
      message: 'Voto rimosso con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nella rimozione voto:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione voto',
      message: error.message,
      details: error.stack
    });
  }
});

// DELETE /api/opinioni-proposte/:id - Cancella un'opinione proposta (solo admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    console.log('🗑️ DELETE /api/opinioni-proposte/:id - Cancellazione opinione proposta');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Verifica che l'utente sia admin
    const userQuery = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userRole = userQuery.rows[0].role;
    if (userRole !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Solo gli amministratori possono cancellare opinioni'
      });
    }
    
    // Verifica se l'opinione esiste
    const checkQuery = `
      SELECT id FROM opinioni_domande 
      WHERE id = $1 AND 'da approvare' = ANY(gradi_opinione)
    `;
    
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    // Cancella i voti associati
    await pool.query(
      'DELETE FROM voti_opinioni_proposte WHERE opinione_id = $1',
      [id]
    );
    
    // Cancella l'opinione
    const deleteResult = await pool.query(
      'DELETE FROM opinioni_domande WHERE id = $1',
      [id]
    );
    
    console.log('✅ Opinione cancellata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione cancellata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nella cancellazione opinione:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nella cancellazione opinione',
      message: error.message,
      details: error.stack
    });
  }
});

module.exports = router;