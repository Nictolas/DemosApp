const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// GET /api/amnistia - Ottieni leggi per amnistia
router.get('/', async (req, res) => {
  try {
    // 1. Ottieni tutte le amnistie dalla tabella amnistia
    const amnistieQuery = `
      SELECT id, legge, articolo, descrizione, data_creazione
      FROM amnistia 
      ORDER BY data_creazione DESC
    `;
    const amnistieResult = await pool.query(amnistieQuery);
    
    // 2. Genera classifica basata sui voti usando la relazione amnistia_id
    const classificaQuery = `
      SELECT 
        a.id,
        a.legge,
        a.articolo,
        a.descrizione,
        COUNT(va.amnistia_id) as voti
      FROM amnistia a
      LEFT JOIN voti_amnistia va ON a.id = va.amnistia_id
      GROUP BY a.id, a.legge, a.articolo, a.descrizione
      ORDER BY voti DESC, a.legge ASC
    `;
    const classificaResult = await pool.query(classificaQuery);
    
    // 3. Se l'utente è autenticato, ottieni i suoi voti usando amnistia_id
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        const userVotiQuery = `
          SELECT a.legge 
          FROM voti_amnistia va
          JOIN amnistia a ON va.amnistia_id = a.id
          WHERE va.userid = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.legge);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per amnistia, continuando senza autenticazione');
      }
    }
    
    console.log(`✅ Recuperate ${amnistieResult.rows.length} amnistie e ${classificaResult.rows.length} voci in classifica`);
    
    res.json({
      success: true,
      amnistie: amnistieResult.rows,
      classifica: classificaResult.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare leggi amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare leggi amnistia'
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
    
    // 1. Aggiungi colonna amnistia_id a voti_amnistia
    await pool.query(`
      ALTER TABLE voti_amnistia 
      ADD COLUMN IF NOT EXISTS amnistia_id UUID
    `);
    console.log('✅ Colonna amnistia_id aggiunta');
    
    // 2. Popola la colonna amnistia_id con gli ID corretti
    const votiData = await pool.query(`
      SELECT DISTINCT legge FROM voti_amnistia WHERE amnistia_id IS NULL
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
          'UPDATE voti_amnistia SET amnistia_id = $1 WHERE legge = $2 AND amnistia_id IS NULL',
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

module.exports = router;
