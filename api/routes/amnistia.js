const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

const router = express.Router();

// GET /api/amnistia - Ottieni leggi per amnistia
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/amnistia chiamato');
    const userId = req.userId || req.user?.id;
    
    // Query per tutte le amnistie
    const amnistieQuery = `SELECT * FROM amnistia WHERE attiva = true ORDER BY legge`;
    const amnistieResult = await pool.query(amnistieQuery);
    console.log(`✅ Recuperate ${amnistieResult.rows.length} amnistie`);
    
    // Query per i voti dell'utente
    let mieiVoti = [];
    if (userId) {
      try {
        const votiQuery = `SELECT legge FROM voti_amnistia WHERE userid = $1`;
        const votiResult = await pool.query(votiQuery, [userId]);
        mieiVoti = votiResult.rows.map(row => row.legge);
        console.log(`✅ Recuperati ${mieiVoti.length} voti per l'utente`);
      } catch (votiError) {
        console.log('⚠️ Errore nel recuperare voti (probabilmente tabella non esiste):', votiError.message);
        mieiVoti = [];
      }
    }
    
    // Query per contare i voti per ogni amnistia
    const votiCountQuery = `
      SELECT legge, COUNT(*) as voti 
      FROM voti_amnistia 
      GROUP BY legge
    `;
    let votiCountMap = {};
    try {
      const votiCountResult = await pool.query(votiCountQuery);
      votiCountResult.rows.forEach(row => {
        votiCountMap[row.legge] = parseInt(row.voti);
      });
    } catch (error) {
      console.log('⚠️ Errore nel contare voti:', error.message);
    }
    
    // Crea classifica con voti reali
    const classificaResult = amnistieResult.rows.map(amnistia => ({
      id: amnistia.id,
      legge: amnistia.legge,
      articolo: amnistia.articolo || '',
      descrizione: amnistia.descrizione || '',
      fonte_url: amnistia.fonte_url || null,
      precedente_storico: amnistia.precedente_storico || null,
      voti: votiCountMap[amnistia.legge] || 0
    }));
    
    // Ordina la classifica per voti in ordine decrescente (più voti in alto)
    classificaResult.sort((a, b) => b.voti - a.voti);
    
    res.json({
      success: true,
      amnistie: amnistieResult.rows,
      classifica: classificaResult,
      mieiVoti: mieiVoti,
      blocco: await getPreferenceCooldown(pool, {
        userId,
        scope: 'amnistia:preferenza'
      }).then((cooldown) => ({ isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate }))
    });
  } catch (error) {
    if (sendCooldownError(res, error)) return;
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
router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    if (!legge) {
      return res.status(400).json({
        success: false,
        error: 'Il campo legge è obbligatorio'
      });
    }
    
    // Prima trova l'ID di amnistia corrispondente alla legge
    const amnistiaResult = await pool.query(
      'SELECT id FROM amnistia WHERE legge = $1 AND attiva = true',
      [legge]
    );
    
    if (amnistiaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Amnistia non trovata'
      });
    }
    
    const amnistiaId = amnistiaResult.rows[0].id;
    
    const existingVote = await pool.query(
      'SELECT id, legge FROM voti_amnistia WHERE userid = $1 LIMIT 1',
      [userId]
    );
    const current = existingVote.rows[0] || null;
    if (current?.legge === legge) {
      return res.json({ success: true, message: 'Preferenza Amnistia già aggiornata' });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'amnistia:preferenza',
      isAdmin: Boolean(req.user?.isAdmin)
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (current) {
        await client.query('DELETE FROM voti_amnistia WHERE userid = $1', [userId]);
      }
      await client.query(
        'INSERT INTO voti_amnistia (userid, amnistia_id, legge) VALUES ($1, $2, $3)',
        [userId, amnistiaId, legge]
      );
      await recordPreferenceChange(client, { userId, scope: 'amnistia:preferenza' });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Voto amnistia salvato' });
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌ Errore nel salvare voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voto amnistia',
      details: error.message
    });
  }
});

// DELETE /api/amnistia/vota - Rimuovi voto per amnistia
router.delete('/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId;
    
    // I voti storici o per reati disattivati restano rimovibili.
    const existing = await pool.query(
      'SELECT id FROM voti_amnistia WHERE userid = $1 AND legge = $2 LIMIT 1',
      [userId, legge]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Voto non trovato' });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'amnistia:preferenza',
      isAdmin: Boolean(req.user?.isAdmin)
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'DELETE FROM voti_amnistia WHERE userid = $1 AND legge = $2',
        [userId, legge]
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Voto non trovato' });
      }
      await recordPreferenceChange(client, { userId, scope: 'amnistia:preferenza' });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Voto amnistia rimosso' });
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌ Errore nel rimuovere voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rimuovere voto amnistia'
    });
  }
});

// POST /api/amnistia - Crea nuova amnistia
router.post('/', verifyToken, (_req, res) => res.status(410).json({
  success: false, error: 'Usa la sezione Proponi soggetto: ogni richiesta deve essere approvata dall’admin.'
}));

// POST /api/amnistia/migrate - Migra dati da voti_amnistia
router.post('/migrate', verifyToken, requireAdmin, async (req, res) => {
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
router.post('/migrate-ids', verifyToken, requireAdmin, async (req, res) => {
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
router.get('/test', verifyToken, requireAdmin, (req, res) => {
  console.log('🔍 Test endpoint amnistia chiamato');
  res.json({
    success: true,
    message: 'Test endpoint funziona',
    timestamp: new Date().toISOString()
  });
});

// GET /api/amnistia/debug - Debug endpoint per verificare database
router.get('/debug', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 Debug endpoint amnistia chiamato');
    
    // Test connessione database
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connesso:', testQuery.rows[0].current_time);
    
    // Test tabella amnistia
    const amnistiaCount = await pool.query('SELECT COUNT(*) as count FROM amnistia');
    console.log('✅ Righe in amnistia:', amnistiaCount.rows[0].count);
    
    // Test struttura tabella amnistia
    const amnistiaStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'amnistia'
      ORDER BY ordinal_position
    `);
    console.log('📋 Colonne tabella amnistia:', amnistiaStructure.rows);
    
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
    
    // Test primary key di voti_amnistia
    const primaryKeyCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.key_column_usage 
      WHERE table_name = 'voti_amnistia' 
      AND constraint_name LIKE '%_pkey'
    `);
    console.log('🔑 Primary key voti_amnistia:', primaryKeyCheck.rows);
    
    res.json({
      success: true,
      database_connected: true,
      amnistia_count: amnistiaCount.rows[0].count,
      amnistia_columns: amnistiaStructure.rows,
      voti_count: votiCount.rows[0].count,
      amnistia_id_exists: amnistiaIdExists,
      primary_key_exists: primaryKeyCheck.rows.length > 0,
      primary_key_columns: primaryKeyCheck.rows,
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

// POST /api/amnistia/fix-primary-key - Aggiungi primary key a voti_amnistia
router.post('/fix-primary-key', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Aggiungendo primary key a voti_amnistia...');
    
    // 1. Verifica se esiste già una primary key
    const existingPK = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'voti_amnistia' 
      AND constraint_type = 'PRIMARY KEY'
    `);
    
    if (existingPK.rows.length > 0) {
      console.log('✅ Primary key già esistente:', existingPK.rows[0].constraint_name);
      return res.json({
        success: true,
        message: 'Primary key già esistente',
        constraint_name: existingPK.rows[0].constraint_name
      });
    }
    
    // 2. Aggiungi primary key alla colonna id
    await pool.query(`
      ALTER TABLE voti_amnistia 
      ADD CONSTRAINT voti_amnistia_pkey PRIMARY KEY (id)
    `);
    console.log('✅ Primary key aggiunta alla colonna id');
    
    // 3. Verifica il risultato
    const verifyPK = await pool.query(`
      SELECT constraint_name, column_name 
      FROM information_schema.key_column_usage 
      WHERE table_name = 'voti_amnistia' 
      AND constraint_name LIKE '%_pkey'
    `);
    
    res.json({
      success: true,
      message: 'Primary key aggiunta con successo',
      primary_key: verifyPK.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiungere primary key:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiungere primary key',
      details: error.message
    });
  }
});

module.exports = router;
