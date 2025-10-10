const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// GET /api/amnistia - Ottieni leggi per amnistia
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/amnistia chiamato');
    
    // Query semplificata per test
    const simpleQuery = `
      SELECT 
        id,
        legge,
        articolo,
        descrizione
      FROM amnistia 
      ORDER BY legge ASC
    `;
    
    const result = await pool.query(simpleQuery);
    console.log(`✅ Recuperate ${result.rows.length} amnistie`);
    
    // Crea classifica con voti a 0 per ora
    const classificaResult = result.rows.map(amnistia => ({
      id: amnistia.id,
      legge: amnistia.legge,
      articolo: amnistia.articolo,
      descrizione: amnistia.descrizione,
      voti: 0
    }));
    
    res.json({
      success: true,
      amnistie: result.rows,
      classifica: classificaResult,
      mieiVoti: [],
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare leggi amnistia:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare leggi amnistia',
      details: error.message
    });
  }
});

// POST /api/amnistia/vota - Vota per amnistia
router.post('/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Prima trova l'ID di amnistia corrispondente alla legge
    const amnistiaResult = await pool.query(
      'SELECT id FROM amnistia WHERE legge = $1',
      [legge]
    );
    
    if (amnistiaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Amnistia non trovata'
      });
    }
    
    const amnistiaId = amnistiaResult.rows[0].id;
    
    // Inserisci il voto usando l'ID di amnistia
    await pool.query(
      'INSERT INTO voti_amnistia (userid, amnistia_id, legge) VALUES ($1, $2, $3) ON CONFLICT (userid, amnistia_id) DO NOTHING',
      [userId, amnistiaId, legge]
    );
    
    res.json({ success: true, message: 'Voto amnistia salvato' });
  } catch (error) {
    console.error('❌ Errore nel salvare voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voto amnistia'
    });
  }
});

// DELETE /api/amnistia/vota - Rimuovi voto per amnistia
router.delete('/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId;
    
    // Prima trova l'ID di amnistia corrispondente alla legge
    const amnistiaResult = await pool.query(
      'SELECT id FROM amnistia WHERE legge = $1',
      [legge]
    );
    
    if (amnistiaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Amnistia non trovata'
      });
    }
    
    const amnistiaId = amnistiaResult.rows[0].id;
    
    // Rimuovi il voto usando l'ID di amnistia
    const result = await pool.query(
      'DELETE FROM voti_amnistia WHERE userid = $1 AND amnistia_id = $2',
      [userId, amnistiaId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato'
      });
    }
    
    res.json({ success: true, message: 'Voto amnistia rimosso' });
  } catch (error) {
    console.error('❌ Errore nel rimuovere voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rimuovere voto amnistia'
    });
  }
});

// POST /api/amnistia - Crea nuova amnistia
router.post('/', verifyToken, validateInput(['legge', 'articolo', 'descrizione']), async (req, res) => {
  try {
    const { legge, articolo, descrizione } = req.body;
    
    // Prima crea la tabella se non esiste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS amnistia (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legge VARCHAR(255) NOT NULL,
        articolo VARCHAR(255) NOT NULL,
        descrizione TEXT NOT NULL,
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserisci la nuova amnistia
    const result = await pool.query(
      'INSERT INTO amnistia (legge, articolo, descrizione) VALUES ($1, $2, $3) RETURNING *',
      [legge, articolo, descrizione]
    );
    
    console.log('✅ Nuova amnistia creata:', result.rows[0]);
    
    res.json({
      success: true,
      message: 'Amnistia creata con successo',
      amnistia: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel creare amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel creare amnistia'
    });
  }
});

// POST /api/amnistia/migrate - Migra dati da voti_amnistia
router.post('/migrate', async (req, res) => {
  try {
    console.log('🔄 Avviando migrazione dati amnistia...');
    
    // 1. Aggiungi colonne se non esistono
    await pool.query(`
      ALTER TABLE amnistia 
      ADD COLUMN IF NOT EXISTS articolo VARCHAR(255),
      ADD COLUMN IF NOT EXISTS descrizione TEXT
    `);
    console.log('✅ Colonne aggiunte alla tabella amnistia');
    
    // 2. Ottieni leggi distinte da voti_amnistia
    const votiData = await pool.query(`
      SELECT DISTINCT legge, COUNT(*) as voti_count
      FROM voti_amnistia 
      GROUP BY legge
      ORDER BY voti_count DESC
    `);
    
    console.log(`📊 Trovate ${votiData.rows.length} leggi distinte in voti_amnistia`);
    
    let inserted = 0;
    let skipped = 0;
    
    // 3. Inserisci i dati nella tabella amnistia
    for (const row of votiData.rows) {
      // Controlla se la legge esiste già in amnistia
      const existing = await pool.query(
        'SELECT id FROM amnistia WHERE legge = $1',
        [row.legge]
      );
      
      if (existing.rows.length === 0) {
        // Inserisci la nuova legge
        await pool.query(`
          INSERT INTO amnistia (legge, articolo, descrizione) 
          VALUES ($1, $2, $3)
        `, [
          row.legge,
          'Art. 1', // Articolo di default
          `Amnistia per ${row.legge}` // Descrizione di default
        ]);
        inserted++;
        console.log(`✅ Inserita: ${row.legge}`);
      } else {
        skipped++;
        console.log(`⚠️ Già esistente: ${row.legge}`);
      }
    }
    
    // 4. Verifica il risultato
    const finalCount = await pool.query('SELECT COUNT(*) FROM amnistia');
    
    res.json({
      success: true,
      message: 'Migrazione completata con successo',
      data: {
        leggiTrovate: votiData.rows.length,
        inserite: inserted,
        saltate: skipped,
        totaleInAmnistia: parseInt(finalCount.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la migrazione'
    });
  }
});

// POST /api/amnistia/migrate-ids - Migra voti_amnistia per usare ID di amnistia
router.post('/migrate-ids', async (req, res) => {
  try {
    console.log('🔄 Migrando voti_amnistia per usare ID di amnistia...');
    
    // 1. Rimuovi colonna amnistia_id se esiste (per ricrearla con il tipo corretto)
    try {
      await pool.query(`
        ALTER TABLE voti_amnistia 
        DROP COLUMN IF EXISTS amnistia_id
      `);
      console.log('✅ Colonna amnistia_id rimossa (se esisteva)');
    } catch (dropError) {
      console.log('⚠️ Errore nel rimuovere colonna (probabilmente non esiste):', dropError.message);
    }
    
    // 2. Aggiungi colonna amnistia_id come INTEGER (per corrispondere a amnistia.id)
    await pool.query(`
      ALTER TABLE voti_amnistia 
      ADD COLUMN amnistia_id INTEGER
    `);
    console.log('✅ Colonna amnistia_id aggiunta come INTEGER');
    
    // 3. Popola la colonna amnistia_id con gli ID corretti
    const votiData = await pool.query(`
      SELECT DISTINCT legge FROM voti_amnistia
    `);
    
    console.log(`📊 Trovate ${votiData.rows.length} leggi da aggiornare`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const row of votiData.rows) {
      // Trova l'ID corrispondente in amnistia
      const amnistiaResult = await pool.query(
        'SELECT id FROM amnistia WHERE legge = $1',
        [row.legge]
      );
      
      if (amnistiaResult.rows.length > 0) {
        // Aggiorna voti_amnistia con l'ID corretto
        const updateResult = await pool.query(
          'UPDATE voti_amnistia SET amnistia_id = $1 WHERE legge = $2',
          [amnistiaResult.rows[0].id, row.legge]
        );
        updated += updateResult.rowCount;
        console.log(`✅ Aggiornati ${updateResult.rowCount} voti per: ${row.legge}`);
      } else {
        notFound++;
        console.log(`⚠️ Legge non trovata in amnistia: ${row.legge}`);
      }
    }
    
    // 3. Verifica il risultato
    const finalCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(amnistia_id) as with_id,
        COUNT(*) - COUNT(amnistia_id) as without_id
      FROM voti_amnistia
    `);
    
    const stats = finalCheck.rows[0];
    
    res.json({
      success: true,
      message: 'Migrazione ID completata con successo',
      data: {
        leggiProcessate: votiData.rows.length,
        votiAggiornati: updated,
        leggiNonTrovate: notFound,
        totaleVoti: parseInt(stats.total),
        conAmnistiaId: parseInt(stats.with_id),
        senzaAmnistiaId: parseInt(stats.without_id)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione ID:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la migrazione ID'
    });
  }
});

// GET /api/amnistia/test - Test endpoint per debug
router.get('/test', (req, res) => {
  console.log('🔍 Test endpoint amnistia chiamato');
  res.json({
    success: true,
    message: 'Test endpoint funziona',
    timestamp: new Date().toISOString()
  });
});

// GET /api/amnistia/debug - Debug endpoint per verificare database
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint amnistia chiamato');
    
    // Test connessione database
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connesso:', testQuery.rows[0].current_time);
    
    // Test tabella amnistia
    const amnistiaCount = await pool.query('SELECT COUNT(*) as count FROM amnistia');
    console.log('✅ Righe in amnistia:', amnistiaCount.rows[0].count);
    
    // Test tabella voti_amnistia
    const votiCount = await pool.query('SELECT COUNT(*) as count FROM voti_amnistia');
    console.log('✅ Righe in voti_amnistia:', votiCount.rows[0].count);
    
    // Test colonna amnistia_id
    let amnistiaIdExists = false;
    try {
      const amnistiaIdTest = await pool.query('SELECT amnistia_id FROM voti_amnistia LIMIT 1');
      amnistiaIdExists = true;
      console.log('✅ Colonna amnistia_id esiste');
    } catch (error) {
      console.log('⚠️ Colonna amnistia_id non esiste:', error.message);
    }
    
    res.json({
      success: true,
      database_connected: true,
      amnistia_count: amnistiaCount.rows[0].count,
      voti_count: votiCount.rows[0].count,
      amnistia_id_exists: amnistiaIdExists,
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

module.exports = router;
