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
    
    // Recupera le notifiche da tutte e tre le tabelle
    console.log(`🔍 Query notifiche per user_id: ${user_id}`);
    
    let votiComuniResult, demosResult, comunaliResult;
    
    // Recupera da notifiche_voti_comuni
    try {
      // Verifica colonne disponibili
      const votiComuniColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifiche_voti_comuni'
      `);
      const votiComuniCols = votiComuniColumns.rows.map(r => r.column_name);
      console.log('📋 Colonne disponibili in notifiche_voti_comuni:', votiComuniCols);
      
      if (!votiComuniCols.includes('titolo') || !votiComuniCols.includes('testo')) {
        console.warn('⚠️ Colonne titolo o testo mancanti in notifiche_voti_comuni');
        votiComuniResult = { rows: [] };
      } else {
        // Verifica se ci sono righe nella tabella
        const countResult = await pool.query('SELECT COUNT(*) as count FROM notifiche_voti_comuni');
        const rowCount = parseInt(countResult.rows[0]?.count || '0');
        console.log(`📊 Righe totali in notifiche_voti_comuni: ${rowCount}`);
        
        if (rowCount === 0) {
          console.warn('⚠️ Tabella notifiche_voti_comuni è vuota');
        }
        // Costruisci la query dinamicamente
        const votoCol = votiComuniCols.includes('voto') ? 'voto' : 'NULL::TEXT as voto';
        const comuneCol = votiComuniCols.includes('comune_residenza') ? 'comune_residenza' : 'NULL::TEXT as comune_residenza';
        const politicoCol = votiComuniCols.includes('politico') ? 'politico' : 'NULL::TEXT as politico';
        const likesCol = votiComuniCols.includes('likes') ? 'COALESCE(likes, 0) as likes' : '0::INTEGER as likes';
        const dislikesCol = votiComuniCols.includes('dislikes') ? 'COALESCE(dislikes, 0) as dislikes' : '0::INTEGER as dislikes';
        const dataCol = votiComuniCols.includes('data') ? 'COALESCE(data, CURRENT_DATE) as data' : 'CURRENT_DATE as data';
        const orderByCol = votiComuniCols.includes('data') ? 'COALESCE(data, CURRENT_DATE) DESC' : 'CURRENT_DATE DESC';
        
        // Query con JOIN per ottenere l'avatar del politico
        // Gestisce sia il caso in cui politico è l'ID (stringa) che quando è nome e cognome
        const query = `
          SELECT 
            nv.id,
            nv.id_utente,
            nv.titolo,
            nv.testo,
            ${dataCol},
            ${votoCol},
            ${comuneCol},
            ${politicoCol},
            ${likesCol},
            ${dislikesCol},
            'notifiche_voti_comuni' as tabella_origine,
            COALESCE(u.avatar_config, NULL) as politico_avatar_config,
            COALESCE(u.nome, NULL) as politico_nome,
            COALESCE(u.cognome, NULL) as politico_cognome
          FROM notifiche_voti_comuni nv
          LEFT JOIN users u ON (
            CASE 
              WHEN nv.politico IS NOT NULL THEN
                (u.id::text = nv.politico OR u.nome || ' ' || u.cognome = nv.politico)
              ELSE
                u.id = nv.id_utente
            END
          )
          ORDER BY ${orderByCol}
          LIMIT 50
        `;
        
        console.log('📋 Query notifiche_voti_comuni:', query);
        votiComuniResult = await pool.query(query);
        console.log(`✅ Notifiche voti comuni recuperate: ${votiComuniResult.rows.length}`);
        if (votiComuniResult.rows.length > 0) {
          console.log('📋 Prime 3 notifiche voti comuni:', votiComuniResult.rows.slice(0, 3).map(n => ({
            id: n.id,
            titolo: n.titolo,
            politico: n.politico,
            politico_nome: n.politico_nome,
            politico_cognome: n.politico_cognome
          })));
        }
      }
    } catch (err) {
      console.error('❌ Errore query notifiche_voti_comuni:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        detail: err.detail
      });
      votiComuniResult = { rows: [] };
    }
    
    // Recupera da notifiche_demos (senza comune_residenza)
    try {
      // Verifica colonne disponibili
      const demosColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos'
      `);
      const demosCols = demosColumns.rows.map(r => r.column_name);
      console.log('📋 Colonne disponibili in notifiche_demos:', demosCols);
      
      if (!demosCols.includes('titolo') || !demosCols.includes('testo')) {
        console.warn('⚠️ Colonne titolo o testo mancanti in notifiche_demos');
        demosResult = { rows: [] };
      } else {
        demosResult = await pool.query(`
          SELECT 
            id,
            id_utente,
            titolo,
            testo,
            COALESCE(data, CURRENT_DATE) as data,
            NULL::TEXT as comune_residenza,
            'notifiche_demos' as tabella_origine
          FROM notifiche_demos
          ORDER BY COALESCE(data, CURRENT_DATE) DESC
          LIMIT 50
        `);
        console.log(`✅ Notifiche demos recuperate: ${demosResult.rows.length}`);
      }
    } catch (err) {
      console.error('❌ Errore query notifiche_demos:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        detail: err.detail
      });
      demosResult = { rows: [] };
    }
    
    // Recupera da notifiche_comunali (gestisce sia struttura nuova che vecchia)
    try {
      // Prima verifica quali colonne esistono
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifiche_comunali'
      `);
      const existingColumns = columnCheck.rows.map(r => r.column_name);
      console.log('📋 Colonne disponibili in notifiche_comunali:', existingColumns);
      
      // Costruisci la query in base alle colonne disponibili
      let selectParts = ['id', 'id_utente'];
      
      if (existingColumns.includes('titolo')) {
        selectParts.push('COALESCE(titolo, \'Notifica Comunale\') as titolo');
      } else if (existingColumns.includes('tipologia') && existingColumns.includes('dove')) {
        selectParts.push(`COALESCE(tipologia || ' - ' || dove, 'Notifica Comunale') as titolo`);
      } else if (existingColumns.includes('tipologia')) {
        selectParts.push(`COALESCE(tipologia, 'Notifica Comunale') as titolo`);
      } else if (existingColumns.includes('dove')) {
        selectParts.push(`COALESCE(dove, 'Notifica Comunale') as titolo`);
      } else {
        selectParts.push(`'Notifica Comunale' as titolo`);
      }
      
      if (existingColumns.includes('testo')) {
        selectParts.push('COALESCE(testo, \'Notifica comunale\') as testo');
      } else {
        let testoParts = [];
        if (existingColumns.includes('tipologia')) testoParts.push(`COALESCE('Tipologia: ' || tipologia, '')`);
        if (existingColumns.includes('dove')) testoParts.push(`COALESCE('Dove: ' || dove, '')`);
        if (existingColumns.includes('dal_giorno')) testoParts.push(`COALESCE('Dal: ' || dal_giorno::text, '')`);
        if (existingColumns.includes('al_giorno')) testoParts.push(`COALESCE('Al: ' || al_giorno::text, '')`);
        
        if (testoParts.length > 0) {
          selectParts.push(`(${testoParts.join(' || E\'\\n\' || ')}) as testo`);
        } else {
          selectParts.push(`'Notifica comunale' as testo`);
        }
      }
      
      if (existingColumns.includes('data')) {
        selectParts.push('COALESCE(data, CURRENT_DATE) as data');
      } else if (existingColumns.includes('dal_giorno')) {
        selectParts.push('COALESCE(dal_giorno, CURRENT_DATE) as data');
      } else {
        selectParts.push('CURRENT_DATE as data');
      }
      
      if (existingColumns.includes('comune_residenza')) {
        selectParts.push('comune_residenza');
      } else if (existingColumns.includes('dove')) {
        selectParts.push('dove as comune_residenza');
      } else if (existingColumns.includes('zona')) {
        selectParts.push('zona as comune_residenza');
      } else {
        selectParts.push('NULL::TEXT as comune_residenza');
      }
      
      // notifiche_comunali non ha likes/dislikes, quindi non li includiamo
      selectParts.push(`'notifiche_comunali' as tabella_origine`);
      
      const orderBy = existingColumns.includes('data') 
        ? 'COALESCE(data, CURRENT_DATE) DESC'
        : existingColumns.includes('dal_giorno')
        ? 'COALESCE(dal_giorno, CURRENT_DATE) DESC'
        : 'CURRENT_DATE DESC';
      
      const query = `
        SELECT ${selectParts.join(', ')}
        FROM notifiche_comunali
        ORDER BY ${orderBy}
        LIMIT 50
      `;
      
      console.log('📋 Query notifiche_comunali:', query);
      comunaliResult = await pool.query(query);
      console.log(`✅ Notifiche comunali recuperate: ${comunaliResult.rows.length}`);
    } catch (err) {
      console.error('❌ Errore query notifiche_comunali:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        detail: err.detail
      });
      comunaliResult = { rows: [] };
    }
    
    // Combina tutte le notifiche
    const votiComuniRows = votiComuniResult?.rows || [];
    const demosRows = demosResult?.rows || [];
    const comunaliRows = comunaliResult?.rows || [];
    
    const allNotificheRaw = [
      ...votiComuniRows.map(n => ({ ...n, tipo_notifica: 'voto_comune' })),
      ...demosRows.map(n => ({ ...n, tipo_notifica: 'demos' })),
      ...comunaliRows.map(n => ({ ...n, tipo_notifica: 'comunale' }))
    ];
    
    console.log(`📊 Notifiche raw combinate: voti_comuni=${votiComuniRows.length}, demos=${demosRows.length}, comunali=${comunaliRows.length}, totale=${allNotificheRaw.length}`);
    
    if (votiComuniRows.length > 0) {
      console.log('📋 Esempio notifica voto_comune:', {
        id: votiComuniRows[0].id,
        titolo: votiComuniRows[0].titolo,
        tipo_notifica: 'voto_comune',
        politico: votiComuniRows[0].politico,
        politico_nome: votiComuniRows[0].politico_nome,
        politico_cognome: votiComuniRows[0].politico_cognome
      });
    }
    
    // Mappa le notifiche nel formato atteso dal frontend
    const comunicazioni = allNotificheRaw.map(c => {
      return {
        id: c.id,
        titolo: c.titolo || 'Nessun titolo',
        messaggio: c.testo || 'Nessun messaggio',
        data_creazione: c.data,
        data: c.data,
        tipo_notifica: c.tipo_notifica,
        status: 'non_letta', // Le notifiche non hanno più read_by, quindi tutte sono "non lette"
        voto: c.voto || null,
        comune_residenza: c.comune_residenza || null,
        politico: c.politico || null,
        politico_avatar_config: c.politico_avatar_config || null,
        politico_nome: c.politico_nome || null,
        politico_cognome: c.politico_cognome || null,
        likes: c.likes !== undefined ? c.likes : (c.tipo_notifica === 'comunale' ? undefined : 0),
        dislikes: c.dislikes !== undefined ? c.dislikes : (c.tipo_notifica === 'comunale' ? undefined : 0),
        tabella_origine: c.tabella_origine
      };
    });
    
    console.log(`📊 Notifiche recuperate: voti_comuni=${votiComuniResult.rows.length}, demos=${demosResult.rows.length}, comunali=${comunaliResult.rows.length}, totale=${comunicazioni.length}`);

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
    const allNotifiche = [...comunicazioni, ...segnalazioni].sort((a, b) => {
      const dateA = a.data ? new Date(a.data) : (a.data_creazione ? new Date(a.data_creazione) : new Date(0));
      const dateB = b.data ? new Date(b.data) : (b.data_creazione ? new Date(b.data_creazione) : new Date(0));
      return dateB.getTime() - dateA.getTime();
    });
    
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
