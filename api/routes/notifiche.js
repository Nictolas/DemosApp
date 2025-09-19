const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // Usa sempre Neon per ora
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}); // Usa la stessa configurazione degli altri endpoint

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
      'SELECT is_admin FROM utenti WHERE id = $1',
      [user_id]
    );
    
    const isAdmin = userResult.rows.length > 0 && userResult.rows[0].is_admin === true;
    
    // Recupera le comunicazioni e controlla se l'utente le ha lette
    const comunicazioniResult = await pool.query(`
      SELECT
        c.*,
        $1 = ANY(c.read_by) as is_read
      FROM comunicazioni c
      WHERE c.tipo = 'demos_notification'
      ORDER BY c.data_creazione DESC
      LIMIT 10
    `, [user_id]);
    
    const comunicazioni = comunicazioniResult.rows.map(c => ({
      id: c.id,
      titolo: c.titolo,
      messaggio: c.testo || c.commento || 'Nessun messaggio',
      data_creazione: c.data_creazione,
      tipo_notifica: 'demos_notification',
      status: c.is_read ? 'letta' : 'non_letta',
      commento: c.commento
    }));

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
        LEFT JOIN utenti u ON s.utente_id = u.id
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
    
    console.log('🔍 DEBUG: Comunicazioni trovate:', comunicazioni.length);
    console.log('🔍 DEBUG: Segnalazioni trovate:', segnalazioni.length);
    console.log('🔍 DEBUG: Totale notifiche:', allNotifiche.length);
    
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
    const result = await pool.query(`
      UPDATE comunicazioni 
      SET read_by = array_append(read_by, $1)
      WHERE id = $2 AND $1 != ALL(read_by)
      RETURNING *
    `, [user_id, id]);
    
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
    
    // Aggiorna comunicazioni
    for (const notificaId of comunicazioniIds) {
      const result = await pool.query(`
        UPDATE comunicazioni 
        SET read_by = array_append(read_by, $1)
        WHERE id = $2 AND $1 != ALL(read_by)
        RETURNING id
      `, [user_id, notificaId]);
      
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

module.exports = router;
