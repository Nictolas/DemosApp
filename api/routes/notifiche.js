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
        // Gestisce sia il caso in cui politico è l'ID (UUID) che quando è nome e cognome
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
            u.avatar_config as politico_avatar_config,
            u.nome as politico_nome,
            u.cognome as politico_cognome
          FROM notifiche_voti_comuni nv
          LEFT JOIN users u ON (
            (nv.politico IS NOT NULL AND (
              (nv.politico::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND u.id::text = nv.politico::text)
              OR (nv.politico::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND u.nome || ' ' || u.cognome = nv.politico)
            ))
            OR (nv.politico IS NULL AND u.id = nv.id_utente)
          )
          ORDER BY ${orderByCol}
          LIMIT 50
        `;
        
        console.log('📋 Query notifiche_voti_comuni:', query);
        try {
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
          } else {
            console.warn('⚠️ Nessuna notifica voti comuni trovata nella tabella');
          }
        } catch (queryError) {
          console.error('❌ Errore nell\'esecuzione della query notifiche_voti_comuni:', queryError);
          console.error('❌ Query error details:', {
            message: queryError.message,
            code: queryError.code,
            detail: queryError.detail,
            position: queryError.position
          });
          throw queryError; // Rilancia l'errore per essere catturato dal catch esterno
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
    
    // Recupera da notifiche_avvistamenti
    let avvistamentiResult = { rows: [] };
    try {
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifiche_avvistamenti'
        )
      `);
      
      if (tableExists.rows[0]?.exists) {
        const query = `
          SELECT 
            id,
            id_utente,
            tipo_avvistamento,
            titolo,
            testo,
            comune_residenza,
            COALESCE(data, data_creazione, CURRENT_TIMESTAMP) as data,
            'notifiche_avvistamenti' as tabella_origine
          FROM notifiche_avvistamenti
          ORDER BY COALESCE(data, data_creazione, CURRENT_TIMESTAMP) DESC
          LIMIT 50
        `;
        
        console.log('📋 Query notifiche_avvistamenti:', query);
        avvistamentiResult = await pool.query(query);
        console.log(`✅ Notifiche avvistamenti recuperate: ${avvistamentiResult.rows.length}`);
      } else {
        console.log('⚠️ Tabella notifiche_avvistamenti non trovata');
      }
    } catch (err) {
      console.error('❌ Errore query notifiche_avvistamenti:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        detail: err.detail
      });
      avvistamentiResult = { rows: [] };
    }
    
    // Combina tutte le notifiche
    const votiComuniRows = votiComuniResult?.rows || [];
    const demosRows = demosResult?.rows || [];
    const comunaliRows = comunaliResult?.rows || [];
    const avvistamentiRows = avvistamentiResult?.rows || [];
    
    const allNotificheRaw = [
      ...votiComuniRows.map(n => ({ ...n, tipo_notifica: 'voto_comune' })),
      ...demosRows.map(n => ({ ...n, tipo_notifica: 'demos' })),
      ...comunaliRows.map(n => ({ ...n, tipo_notifica: 'comunale' })),
      ...avvistamentiRows.map(n => ({ ...n, tipo_notifica: 'avvistamento' }))
    ];
    
    console.log(`📊 Notifiche raw combinate: voti_comuni=${votiComuniRows.length}, demos=${demosRows.length}, comunali=${comunaliRows.length}, avvistamenti=${avvistamentiRows.length}, totale=${allNotificheRaw.length}`);
    
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
        voto: c.voto || null,
        comune_residenza: c.comune_residenza || null,
        politico: c.politico || null,
        politico_avatar_config: c.politico_avatar_config || null,
        politico_nome: c.politico_nome || null,
        politico_cognome: c.politico_cognome || null,
        tipo_avvistamento: c.tipo_avvistamento || null, // Per notifiche avvistamenti
        likes: c.likes !== undefined ? c.likes : (c.tipo_notifica === 'comunale' || c.tipo_notifica === 'avvistamento' ? undefined : 0),
        dislikes: c.dislikes !== undefined ? c.dislikes : (c.tipo_notifica === 'comunale' || c.tipo_notifica === 'avvistamento' ? undefined : 0),
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

// Endpoint rimossi: non serve più marcare le notifiche come lette

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
