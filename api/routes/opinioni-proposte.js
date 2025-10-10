const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Funzione per creare la tabella voti se non esiste
async function ensureVotiTableExists() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS voti_opinioni_proposte (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        opinione_id VARCHAR(255) NOT NULL,
        data_voto TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, opinione_id)
      );
    `;
    
    await pool.query(createTableQuery);
    
    // Crea indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_voti_opinioni_user_id 
      ON voti_opinioni_proposte(user_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_voti_opinioni_opinione_id 
      ON voti_opinioni_proposte(opinione_id);
    `);
    
    console.log('✅ Tabella voti_opinioni_proposte verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella voti:', error);
  }
}

// Inizializza la tabella all'avvio
ensureVotiTableExists();

// GET /api/opinioni-proposte - Ottieni opinioni da approvare dalla tabella opinioni
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-proposte - Caricamento opinioni da approvare');
    
    // Query per ottenere opinioni con gradi_opinione contenente "da approvare"
    const query = `
      SELECT o.id, o.text as testo, o.gradi_opinione, o.approfondimento,
             COALESCE(voti_count.count, 0) as voti
      FROM opinioni o
      LEFT JOIN (
        SELECT opinione_id, COUNT(*) as count
        FROM voti_opinioni_proposte
        GROUP BY opinione_id
      ) voti_count ON o.id = voti_count.opinione_id
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
      voti: parseInt(row.voti) || 0
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
    const { testo, titolo, descrizione, categoria } = req.body;
    const userId = 'test-user-id'; // Temporaneo per test
    
    console.log('📝 POST /api/opinioni-proposte - Creazione nuova opinione proposta');
    console.log('🔍 Testo:', testo);
    console.log('🔍 User ID:', userId);
    
    if (!testo || !testo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Testo dell\'opinione obbligatorio'
      });
    }
    
    // Genera ID univoco
    const id = require('crypto').randomUUID();
    
    // Inserisce nella tabella opinioni con gradi_opinione contenente "da approvare"
    const insertQuery = `
      INSERT INTO opinioni (id, text, gradi_opinione, approfondimento)
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
router.post('/:id/vota', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'test-user-id'; // Temporaneo per test
    
    console.log('👍 POST /api/opinioni-proposte/:id/vota - Voto opinione proposta');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Verifica se l'opinione esiste nella tabella opinioni con "da approvare"
    const checkQuery = `
      SELECT id FROM opinioni 
      WHERE id = $1 AND 'da approvare' = ANY(gradi_opinione)
    `;
    
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    // Inserisci il voto nella tabella voti_opinioni_proposte
    const insertVotoQuery = `
      INSERT INTO voti_opinioni_proposte (user_id, opinione_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, opinione_id) DO NOTHING
    `;
    
    await pool.query(insertVotoQuery, [userId, id]);
    
    console.log('✅ Voto registrato con successo per opinione:', id);
    
    res.json({
      success: true,
      message: 'Voto registrato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel voto:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel voto',
      message: error.message
    });
  }
});

// DELETE /api/opinioni-proposte/:id/vota - Rimuovi voto da un'opinione proposta
router.delete('/:id/vota', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'test-user-id'; // Temporaneo per test
    
    console.log('👎 DELETE /api/opinioni-proposte/:id/vota - Rimozione voto');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Verifica se l'opinione esiste nella tabella opinioni con "da approvare"
    const checkQuery = `
      SELECT id FROM opinioni 
      WHERE id = $1 AND 'da approvare' = ANY(gradi_opinione)
    `;
    
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    // Rimuovi il voto dalla tabella voti_opinioni_proposte
    const deleteVotoQuery = `
      DELETE FROM voti_opinioni_proposte 
      WHERE user_id = $1 AND opinione_id = $2
    `;
    
    const result = await pool.query(deleteVotoQuery, [userId, id]);
    
    if (result.rowCount === 0) {
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
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione voto',
      message: error.message
    });
  }
});

module.exports = router;