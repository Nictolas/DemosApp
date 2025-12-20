const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// ===== ENDPOINTS PER NOTIFICHE =====

// GET /api/notifiche - Lista notifiche per utente (include comunicazioni + segnalazioni per admin)
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    console.log('🔍 DEBUG: Recupero notifiche per user_id:', user_id);
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }

    // Verifica se l'utente è admin
    const userResult = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [user_id]
    );
    
    const isAdmin = userResult.rows.length > 0 && userResult.rows[0].is_admin === true;
    
    // Recupera le comunicazioni e controlla se l'utente le ha lette
    // Include sia demos_notification che new_opinions
    // Gestisce sia UUID che VARCHAR per read_by
    console.log(`🔍 Query notifiche per user_id: ${user_id}`);
    
    // Verifica il tipo di read_by
    const readByTypeCheck = await pool.query(`
      SELECT udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni' 
      AND column_name = 'read_by'
    `);
    
    const isUUIDArray = readByTypeCheck.rows.length > 0 && readByTypeCheck.rows[0].udt_name?.includes('uuid');
    
    // Usa la query appropriata in base al tipo
    const isReadQuery = isUUIDArray ? `
      SELECT
        c.*,
        CASE 
          WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
          WHEN $1::uuid = ANY(c.read_by) THEN true
          ELSE false
        END as is_read
      FROM comunicazioni c
      WHERE c.tipo IN ('demos_notification', 'new_opinions')
      ORDER BY c.data_creazione DESC
      LIMIT 10
    ` : `
      SELECT
        c.*,
        CASE 
          WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
          WHEN c.read_by::text[] @> ARRAY[$1::text] THEN true
          ELSE false
        END as is_read
      FROM comunicazioni c
      WHERE c.tipo IN ('demos_notification', 'new_opinions')
      ORDER BY c.data_creazione DESC
      LIMIT 10
    `;
    
    const comunicazioniResult = await pool.query(isReadQuery, [user_id]);
    
    console.log(`📋 Comunicazioni trovate dal DB: ${comunicazioniResult.rows.length}`);
    
    const comunicazioni = comunicazioniResult.rows.map(c => {
      const status = c.is_read ? 'letta' : 'non_letta';
      console.log(`📋 Notifica ${c.id}: is_read=${c.is_read}, status=${status}, read_by=${JSON.stringify(c.read_by)}`);
      return {
        id: c.id,
        titolo: c.titolo,
        messaggio: c.testo || c.commento || 'Nessun messaggio',
        data_creazione: c.data_creazione,
        tipo_notifica: c.tipo,
        status: status,
        commento: c.commento
      };
    });
    
    console.log(`📊 Comunicazioni mappate: ${comunicazioni.length}, non lette: ${comunicazioni.filter(c => c.status === 'non_letta').length}`);

    // Se l'utente è admin, recupera anche le segnalazioni
    let segnalazioni = [];
    if (isAdmin) {
      const segnalazioniResult = await pool.query(`
        SELECT 
          s.id,
          s.titolo,
          s.descrizione as messaggio,
          s.data_creazione,
          s.status,
          s.tipo,
          s.passaggi,
          s.comportamento_atteso,
          s.comportamento_effettivo,
          s.browser,
          s.dispositivo,
          s.metadata,
          u.nome as utente_nome,
          u.cognome as utente_cognome,
          u.email as utente_email
        FROM segnalazioni s
        LEFT JOIN users u ON s.utente_id::uuid = u.id
        ORDER BY s.data_creazione DESC
        LIMIT 10
      `);
      
      segnalazioni = segnalazioniResult.rows.map(s => ({
        id: s.id,
        titolo: `🔧 ${s.titolo}`,
        messaggio: `Da ${s.utente_nome || 'Utente'} ${s.utente_cognome || ''}: ${s.messaggio}`,
        data_creazione: s.data_creazione,
        tipo_notifica: 'segnalazione_problema',
        status: s.status,
        // Dettagli completi della segnalazione
        tipo_segnalazione: s.tipo,
        passaggi: s.passaggi,
        comportamento_atteso: s.comportamento_atteso,
        comportamento_effettivo: s.comportamento_effettivo,
        browser: s.browser,
        dispositivo: s.dispositivo,
        metadata: {
          ...s.metadata,
          utente_nome: s.utente_nome,
          utente_cognome: s.utente_cognome,
          utente_email: s.utente_email,
          tipo_segnalazione: s.tipo
        }
      }));
    }
    
    // Combina tutte le notifiche
    const allNotifiche = [...comunicazioni, ...segnalazioni].sort((a, b) => 
      new Date(b.data_creazione) - new Date(a.data_creazione)
    );
    
    const unreadCount = allNotifiche.filter(n => n.status !== 'letta').length;
    
    console.log('🔍 DEBUG: Comunicazioni trovate:', comunicazioni.length);
    console.log('🔍 DEBUG: Segnalazioni trovate:', segnalazioni.length);
    console.log('🔍 DEBUG: Totale notifiche:', allNotifiche.length);
    console.log('🔍 DEBUG: Notifiche non lette:', unreadCount);
    console.log('🔍 DEBUG: Dettaglio status:', allNotifiche.map(n => ({ id: n.id, status: n.status })));
    
    res.json({
      success: true,
      notifiche: allNotifiche,
      isAdmin: isAdmin,
      stats: {
        comunicazioni: comunicazioni.length,
        segnalazioni: segnalazioni.length,
        totali: allNotifiche.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero notifiche:', error);
    
    // Se è un errore di connessione database, restituisci un messaggio più specifico
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({
        success: false,
        error: 'Errore connessione database',
        details: 'Il server non riesce a connettersi al database. Controllare la configurazione DATABASE_URL su Render.',
        debug: {
          code: error.code,
          message: error.message,
          database_url_present: !!process.env.DATABASE_URL,
          db_host: process.env.DB_HOST
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// PUT /api/notifiche/:id/read - Marca notifica come letta per l'utente specifico
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('📖 Marcatura notifica come letta per utente:', user_id, 'comunicazione:', id);
    
    // Aggiungi l'utente all'array read_by se non è già presente
    // Gestisce sia UUID[] che VARCHAR[] per read_by
    const readByTypeCheck = await pool.query(`
      SELECT udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni' 
      AND column_name = 'read_by'
    `);
    
    const isUUIDArray = readByTypeCheck.rows.length > 0 && readByTypeCheck.rows[0].udt_name?.includes('uuid');
    
    const updateQuery = isUUIDArray ? `
      UPDATE comunicazioni 
      SET read_by = CASE 
        WHEN read_by IS NULL THEN ARRAY[$1::uuid]
        WHEN $1::uuid = ANY(read_by) THEN read_by
        ELSE array_append(read_by, $1::uuid)
      END
      WHERE id = $2 AND ($1::uuid != ALL(read_by) OR read_by IS NULL)
      RETURNING *
    ` : `
      UPDATE comunicazioni 
      SET read_by = CASE 
        WHEN read_by IS NULL THEN ARRAY[$1::text]
        WHEN $1::text = ANY(read_by::text[]) THEN read_by
        ELSE array_append(read_by::text[], $1::text)
      END
      WHERE id = $2 AND ($1::text != ALL(read_by::text[]) OR read_by IS NULL)
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [user_id, id]);
    
    if (result.rows.length === 0) {
      // Controlla se la notifica esiste
      const exists = await pool.query('SELECT id FROM comunicazioni WHERE id = $1', [id]);
      if (exists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Notifica non trovata'
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'Notifica già marcata come letta'
        });
      }
    }
    
    console.log('✅ Notifica marcata come letta per utente:', user_id);
    
    res.json({
      success: true,
      message: 'Notifica marcata come letta',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel marcare notifica come letta:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/notifiche/mark-all-read - Marca tutte le notifiche come lette per l'utente specifico
router.put('/mark-all-read', async (req, res) => {
  try {
    const { notifica_ids, user_id } = req.body;
    
    if (!notifica_ids || !Array.isArray(notifica_ids) || notifica_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array di ID notifiche richiesto'
      });
    }
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('📖 Marcatura di', notifica_ids.length, 'notifiche come lette per utente:', user_id);
    
    // Prima, identifica il tipo di ogni notifica
    let comunicazioniIds = [];
    let segnalazioniIds = [];
    
    for (const notificaId of notifica_ids) {
      // Controlla se è una comunicazione
      const comunicazioneResult = await pool.query(
        'SELECT id FROM comunicazioni WHERE id = $1',
        [notificaId]
      );
      
      if (comunicazioneResult.rows.length > 0) {
        comunicazioniIds.push(notificaId);
      } else {
        // Controlla se è una segnalazione
        const segnalazioneResult = await pool.query(
          'SELECT id FROM segnalazioni WHERE id = $1',
          [notificaId]
        );
        
        if (segnalazioneResult.rows.length > 0) {
          segnalazioniIds.push(notificaId);
        }
      }
    }
    
    let totalUpdated = 0;
    
    // Verifica il tipo di read_by una volta
    const readByTypeCheck = await pool.query(`
      SELECT udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni' 
      AND column_name = 'read_by'
    `);
    
    const isUUIDArray = readByTypeCheck.rows.length > 0 && readByTypeCheck.rows[0].udt_name?.includes('uuid');
    
    // Aggiorna comunicazioni
    for (const notificaId of comunicazioniIds) {
      const updateQuery = isUUIDArray ? `
        UPDATE comunicazioni 
        SET read_by = CASE 
          WHEN read_by IS NULL THEN ARRAY[$1::uuid]
          WHEN $1::uuid = ANY(read_by) THEN read_by
          ELSE array_append(read_by, $1::uuid)
        END
        WHERE id = $2 AND ($1::uuid != ALL(read_by) OR read_by IS NULL)
        RETURNING id
      ` : `
        UPDATE comunicazioni 
        SET read_by = CASE 
          WHEN read_by IS NULL THEN ARRAY[$1::text]
          WHEN $1::text = ANY(read_by::text[]) THEN read_by
          ELSE array_append(read_by::text[], $1::text)
        END
        WHERE id = $2 AND ($1::text != ALL(read_by::text[]) OR read_by IS NULL)
        RETURNING id
      `;
      
      const result = await pool.query(updateQuery, [user_id, notificaId]);
      
      if (result.rows.length > 0) {
        totalUpdated++;
      }
    }
    
    // Aggiorna segnalazioni
    for (const notificaId of segnalazioniIds) {
      const result = await pool.query(`
        UPDATE segnalazioni 
        SET status = 'letta', data_aggiornamento = NOW()
        WHERE id = $1 AND status != 'letta'
        RETURNING id
      `, [notificaId]);
      
      if (result.rows.length > 0) {
        totalUpdated++;
      }
    }
    
    console.log('✅ Notifiche marcate come lette per utente:', totalUpdated);
    
    res.json({
      success: true,
      message: `${totalUpdated} notifiche marcate come lette`,
      data: { updated_count: totalUpdated }
    });
  } catch (error) {
    console.error('❌ Errore nel marcare notifiche come lette:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/notifiche - Crea nuova notifica
router.post('/', async (req, res) => {
  try {
    const { user_id, titolo, messaggio, tipo } = req.body;
    
    if (!user_id || !titolo || !messaggio) {
      return res.status(400).json({
        success: false,
        error: 'ID utente, titolo e messaggio sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO notifiche (user_id, titolo, messaggio, tipo, data_creazione) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [user_id, titolo, messaggio, tipo]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/notifiche/preferenze - Salva preferenze notifiche utente
router.post('/preferenze', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id; // Ottieni user_id dal token
    const { preferenze } = req.body;
    
    if (!preferenze || typeof preferenze !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Preferenze devono essere un oggetto'
      });
    }
    
    // Aggiorna le preferenze notifiche nella tabella users
    // La colonna si chiama notifiche_preferenze
    const result = await pool.query(
      `UPDATE users 
       SET notifiche_preferenze = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, notifiche_preferenze`,
      [JSON.stringify(preferenze), user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log(`✅ Preferenze notifiche salvate per utente ${user_id}:`, preferenze);
    
    res.json({
      success: true,
      message: 'Preferenze salvate con successo',
      data: {
        user_id: result.rows[0].id,
        preferenze: result.rows[0].notifiche_preferenze
      }
    });
  } catch (error) {
    console.error('❌ Errore nel salvataggio preferenze notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;
