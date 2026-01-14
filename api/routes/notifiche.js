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

    // Recupera informazioni utente (is_admin e comune_residenza)
    const userResult = await pool.query(
      'SELECT is_admin, comune_residenza FROM users WHERE id = $1',
      [user_id]
    );
    
    const isAdmin = userResult.rows.length > 0 && userResult.rows[0].is_admin === true;
    const userComuneResidenza = userResult.rows.length > 0 ? userResult.rows[0].comune_residenza : null;
    
    // Recupera le notifiche da tutte e tre le tabelle
    console.log(`🔍 Query notifiche per user_id: ${user_id}`);
    console.log(`🔍 Comune residenza utente: ${userComuneResidenza}`);
    
    let votiComuniResult, demosResult, comunaliResult, votiParlamentoResult;
    
    // Recupera da notifiche_voti_parlamento (solo per i rappresentanti scelti dall'utente)
    try {
      // Trova i rappresentanti scelti dall'utente
      const userResult = await pool.query(
        'SELECT rappresentante_camera, rappresentante_senato FROM users WHERE id = $1',
        [user_id]
      );
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const rappresentantiIds = [];
        
        if (user.rappresentante_camera) {
          rappresentantiIds.push(user.rappresentante_camera);
        }
        if (user.rappresentante_senato) {
          rappresentantiIds.push(user.rappresentante_senato);
        }
        
        if (rappresentantiIds.length > 0) {
          const votiParlamentoQuery = `
            SELECT 
              nvp.id,
              nvp.id_utente,
              nvp.titolo,
              nvp.testo,
              COALESCE(nvp.data, CURRENT_DATE) as data,
              COALESCE(nvp.data_creazione, CURRENT_TIMESTAMP) as data_creazione,
              nvp.voto,
              nvp.camera,
              nvp.politico,
              COALESCE(nvp.likes, 0) as likes,
              COALESCE(nvp.dislikes, 0) as dislikes,
              'notifiche_voti_parlamento' as tabella_origine,
              u.nome as politico_nome,
              u.cognome as politico_cognome,
              u.avatar_config as politico_avatar_config,
              u.genere as politico_genere,
              p.uri as uri_votazione
            FROM notifiche_voti_parlamento nvp
            LEFT JOIN users u ON nvp.id_utente = u.id
            LEFT JOIN parlamento p ON LOWER(TRIM(p.titolo)) = LOWER(TRIM(nvp.titolo)) AND p.camera = nvp.camera
            WHERE nvp.id_utente = ANY($1::uuid[])
            ORDER BY COALESCE(nvp.data_creazione, CURRENT_TIMESTAMP) DESC
            LIMIT 50
          `;
          
          votiParlamentoResult = await pool.query(votiParlamentoQuery, [rappresentantiIds]);
          console.log(`✅ Notifiche voti parlamento recuperate: ${votiParlamentoResult.rows.length}`);
        } else {
          votiParlamentoResult = { rows: [] };
        }
      } else {
        votiParlamentoResult = { rows: [] };
      }
    } catch (err) {
      console.error('❌ Errore query notifiche_voti_parlamento:', err);
      votiParlamentoResult = { rows: [] };
    }
    
    // Recupera da notifiche_voti_comuni
    try {
      // Query semplificata senza JOIN complesso - recupera prima i dati base
      const baseQuery = `
        SELECT 
          id,
          id_utente,
          titolo,
          testo,
          COALESCE(data, CURRENT_DATE) as data,
          COALESCE(data_creazione, CURRENT_TIMESTAMP) as data_creazione,
          voto,
          comune_residenza,
          politico,
          COALESCE(likes, 0) as likes,
          COALESCE(dislikes, 0) as dislikes,
          'notifiche_voti_comuni' as tabella_origine
        FROM notifiche_voti_comuni
        ORDER BY COALESCE(data_creazione, CURRENT_TIMESTAMP) DESC
        LIMIT 50
      `;
      
      console.log('📋 Query base notifiche_voti_comuni');
      votiComuniResult = await pool.query(baseQuery);
      console.log(`✅ Notifiche voti comuni recuperate: ${votiComuniResult.rows.length}`);
      
      // Se ci sono risultati, aggiungi i dati del politico con un secondo query
      if (votiComuniResult.rows.length > 0) {
        console.log('📋 Prime 3 notifiche voti comuni:', votiComuniResult.rows.slice(0, 3).map(n => ({
          id: n.id,
          titolo: n.titolo,
          politico: n.politico
        })));
        
        // Per ogni notifica, recupera i dati del politico se presente
        for (let i = 0; i < votiComuniResult.rows.length; i++) {
          const notifica = votiComuniResult.rows[i];
          if (notifica.politico) {
            try {
              // Prova prima come UUID
              let politicoResult;
              if (notifica.politico.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                politicoResult = await pool.query(
                  'SELECT id, nome, cognome, avatar_config FROM users WHERE id = $1',
                  [notifica.politico]
                );
              } else {
                // Prova come nome e cognome
                politicoResult = await pool.query(
                  `SELECT id, nome, cognome, avatar_config FROM users 
                   WHERE nome || ' ' || cognome = $1 OR nome = $1 OR cognome = $1
                   LIMIT 1`,
                  [notifica.politico]
                );
              }
              
              if (politicoResult.rows.length > 0) {
                const politico = politicoResult.rows[0];
                notifica.politico_avatar_config = politico.avatar_config;
                notifica.politico_nome = politico.nome;
                notifica.politico_cognome = politico.cognome;
              }
            } catch (politicoError) {
              console.warn(`⚠️ Errore nel recupero dati politico per notifica ${notifica.id}:`, politicoError.message);
            }
          }
        }
      } else {
        console.warn('⚠️ Nessuna notifica voti comuni trovata nella tabella');
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
            data_creazione,
            NULL::TEXT as comune_residenza,
            'notifiche_demos' as tabella_origine
          FROM notifiche_demos
          ORDER BY COALESCE(data_creazione, (COALESCE(data, CURRENT_DATE)::timestamp)) DESC
          LIMIT 50
        `);
        console.log(`✅ Notifiche demos recuperate: ${demosResult.rows.length}`);
        // Log di debug per verificare data_creazione
        if (demosResult.rows.length > 0) {
          console.log(`📅 Esempio data_creazione (prima notifica): ${demosResult.rows[0].data_creazione}`);
          console.log(`📅 Esempio data (prima notifica): ${demosResult.rows[0].data}`);
        }
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
        // Verifica colonne disponibili per costruire la query dinamicamente
        const columnsResult = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'notifiche_avvistamenti'
          AND table_schema = 'public'
        `);
        const availableColumns = columnsResult.rows.map(r => r.column_name);
        console.log('📋 Colonne disponibili in notifiche_avvistamenti:', availableColumns);
        
        // Costruisci la query solo con colonne esistenti (escludi esplicitamente 'testo' e 'titolo')
        const selectColumns = [
          'id',
          'id_utente',
          'tipo_avvistamento',
          'comune_residenza'
        ].filter(col => availableColumns.includes(col) && col !== 'testo' && col !== 'titolo');
        
        // Aggiungi data se esiste
        if (availableColumns.includes('data')) {
          selectColumns.push('COALESCE(data, data_creazione, CURRENT_TIMESTAMP) as data');
        } else if (availableColumns.includes('data_creazione')) {
          selectColumns.push('COALESCE(data_creazione, CURRENT_TIMESTAMP) as data');
        } else {
          selectColumns.push('CURRENT_TIMESTAMP as data');
        }
        
        selectColumns.push(`'notifiche_avvistamenti' as tabella_origine`);
        
        const orderBy = availableColumns.includes('data') 
          ? 'COALESCE(data, data_creazione, CURRENT_TIMESTAMP) DESC'
          : availableColumns.includes('data_creazione')
          ? 'data_creazione DESC'
          : 'CURRENT_TIMESTAMP DESC';
        
        // Filtra per comune_residenza dell'utente e aggiungi JOIN con users per nome e cognome
        let whereClause = '';
        const queryParams = [];
        if (userComuneResidenza) {
          whereClause = 'WHERE na.comune_residenza = $1';
          queryParams.push(userComuneResidenza);
        } else {
          // Se l'utente non ha un comune_residenza, non mostra nessuna notifica di avvistamento
          whereClause = 'WHERE 1 = 0'; // Condizione sempre falsa
        }
        
        // Aggiungi JOIN con users per recuperare nome e cognome
        const joinClause = 'LEFT JOIN users u ON na.id_utente = u.id';
        const selectColumnsWithUser = [
          ...selectColumns.map(col => col === 'id' ? 'na.id' : col === 'id_utente' ? 'na.id_utente' : col === 'tipo_avvistamento' ? 'na.tipo_avvistamento' : col === 'comune_residenza' ? 'na.comune_residenza' : col.includes('data') ? col.replace('data', 'na.data') : col.includes('tabella_origine') ? col : `na.${col}`),
          'u.nome as utente_nome',
          'u.cognome as utente_cognome'
        ];
        
        // Verifica che 'testo' non sia presente nella query
        const queryText = `SELECT ${selectColumnsWithUser.join(', ')} FROM notifiche_avvistamenti na ${joinClause} ${whereClause} ORDER BY ${orderBy} LIMIT 50`;
        if (queryText.includes('testo')) {
          console.error('❌ ERRORE: La query contiene ancora "testo"!', queryText);
          throw new Error('La query contiene ancora un riferimento alla colonna "testo"');
        }
        
        console.log('📋 Query notifiche_avvistamenti:', queryText);
        console.log('📋 Parametri query:', queryParams);
        console.log('📋 Colonne selezionate:', selectColumns);
        console.log('📋 Comune residenza utente:', userComuneResidenza);
        avvistamentiResult = await pool.query(queryText, queryParams);
        console.log(`✅ Notifiche avvistamenti recuperate: ${avvistamentiResult.rows.length}`);
      } else {
        console.log('⚠️ Tabella notifiche_avvistamenti non trovata');
      }
    } catch (err) {
      console.error('❌ Errore query notifiche_avvistamenti:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        detail: err.detail,
        position: err.position
      });
      avvistamentiResult = { rows: [] };
    }
    
    // Combina tutte le notifiche
    const votiComuniRows = votiComuniResult?.rows || [];
    const demosRows = demosResult?.rows || [];
    const comunaliRows = comunaliResult?.rows || [];
    const avvistamentiRows = avvistamentiResult?.rows || [];
    const votiParlamentoRows = votiParlamentoResult?.rows || [];
    
    const allNotificheRaw = [
      ...votiComuniRows.map(n => ({ ...n, tipo_notifica: 'voto_comune' })),
      ...votiParlamentoRows.map(n => ({ ...n, tipo_notifica: 'voto_parlamento' })),
      ...demosRows.map(n => ({ ...n, tipo_notifica: 'demos' })),
      ...comunaliRows.map(n => ({ ...n, tipo_notifica: 'comunale' })),
      ...avvistamentiRows.map(n => ({ ...n, tipo_notifica: 'avvistamento' }))
    ];
    
    console.log(`📊 Notifiche raw combinate: voti_comuni=${votiComuniRows.length}, voti_parlamento=${votiParlamentoRows.length}, demos=${demosRows.length}, comunali=${comunaliRows.length}, avvistamenti=${avvistamentiRows.length}, totale=${allNotificheRaw.length}`);
    
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
      // Per le notifiche di avvistamento, costruisci titolo e messaggio da tipo_avvistamento
      // Per le notifiche di voto_comune, costruisci titolo nel formato "Nome Cognome ha votato Voto a Titolo"
      let titolo, messaggio;
      if (c.tipo_notifica === 'avvistamento') {
        titolo = `Avvistamento ${c.tipo_avvistamento || 'Animale'}`;
        messaggio = ''; // Nessun messaggio per le notifiche di avvistamento
      } else if (c.tipo_notifica === 'voto_comune' || c.tipo_notifica === 'voto_parlamento') {
        // Costruisci titolo nel formato: "La senatrice/Il senatore Nome Cognome ha votato Voto a Titolo"
        const nomePolitico = c.politico_nome && c.politico_cognome 
          ? `${c.politico_nome} ${c.politico_cognome}`
          : c.politico || 'Politico';
        const voto = c.voto || 'Voto';
        let titoloVotazione = c.titolo || 'Votazione';
        
        // Rimuovi il nome del politico dal titolo se presente (es: "Votazione Piano Urbanistico - Alberto Cirio" -> "Votazione Piano Urbanistico")
        if (titoloVotazione.includes(' - ')) {
          const parts = titoloVotazione.split(' - ');
          // Se la parte dopo " - " corrisponde al nome del politico, rimuovila
          if (parts.length > 1) {
            const parteDopoTrattino = parts[parts.length - 1].trim();
            if (parteDopoTrattino === nomePolitico || parteDopoTrattino === c.politico) {
              titoloVotazione = parts.slice(0, -1).join(' - ').trim();
            }
          }
        }
        
        // Determina l'articolo e il titolo in base al genere e alla camera
        let articoloETitolo = '';
        if (c.tipo_notifica === 'voto_parlamento') {
          const camera = c.camera || 'Parlamento';
          const genere = c.politico_genere; // "d" = donna, "u" = uomo, "a" = altro/null
          
          if (camera === 'Senato' || camera === 'Senato della Repubblica') {
            if (genere === 'd') {
              articoloETitolo = 'La senatrice';
            } else if (genere === 'u') {
              articoloETitolo = 'Il senatore';
            } else {
              articoloETitolo = 'Il senatore'; // Default
            }
          } else if (camera === 'Camera' || camera === 'Camera dei Deputati') {
            if (genere === 'd') {
              articoloETitolo = 'La deputata';
            } else if (genere === 'u') {
              articoloETitolo = 'Il deputato';
            } else {
              articoloETitolo = 'Il deputato'; // Default
            }
          } else {
            // Fallback generico
            if (genere === 'd') {
              articoloETitolo = 'La parlamentare';
            } else {
              articoloETitolo = 'Il parlamentare';
            }
          }
        } else {
          // Per voto_comune, usa formato generico
          articoloETitolo = 'Il politico';
        }
        
        titolo = `${articoloETitolo} ${nomePolitico} ha votato ${voto} a ${titoloVotazione}`;
        messaggio = c.testo || 'Nessun messaggio';
      } else {
        titolo = c.titolo || 'Nessun titolo';
        messaggio = c.testo || 'Nessun messaggio';
      }
      
      return {
        id: c.id,
        titolo: titolo,
        messaggio: messaggio,
        data_creazione: c.data_creazione || (c.data ? new Date(c.data).toISOString() : new Date().toISOString()), // Usa data_creazione se disponibile, altrimenti converte data in ISO string
        data: c.data,
        tipo_notifica: c.tipo_notifica,
        voto: c.voto || null,
        comune_residenza: c.comune_residenza || null,
        politico: c.politico || null,
        politico_avatar_config: c.politico_avatar_config || null,
        politico_nome: c.politico_nome || null,
        politico_cognome: c.politico_cognome || null,
        tipo_avvistamento: c.tipo_avvistamento || null, // Per notifiche avvistamenti
        utente_nome: c.utente_nome || null, // Nome utente che ha fatto la segnalazione
        utente_cognome: c.utente_cognome || null, // Cognome utente che ha fatto la segnalazione
        likes: c.likes !== undefined ? c.likes : (c.tipo_notifica === 'comunale' || c.tipo_notifica === 'avvistamento' ? undefined : 0),
        dislikes: c.dislikes !== undefined ? c.dislikes : (c.tipo_notifica === 'comunale' || c.tipo_notifica === 'avvistamento' ? undefined : 0),
        tabella_origine: c.tabella_origine,
        uri_votazione: c.uri_votazione || null // URI per aprire il dialog con i dettagli della votazione
      };
    });
    
    console.log(`📊 Notifiche recuperate: voti_comuni=${votiComuniResult.rows.length}, voti_parlamento=${votiParlamentoResult?.rows?.length || 0}, demos=${demosResult.rows.length}, comunali=${comunaliResult.rows.length}, totale=${comunicazioni.length}`);
    
    // Debug: verifica notifiche parlamentari
    const notificheParlamento = comunicazioni.filter(c => c.tipo_notifica === 'voto_parlamento');
    if (notificheParlamento.length > 0) {
      console.log('🔍 DEBUG - Notifiche parlamentari trovate:', notificheParlamento.map(n => ({
        id: n.id?.substring(0, 8),
        tipo_notifica: n.tipo_notifica,
        politico: n.politico,
        politico_avatar_config: n.politico_avatar_config ? 'Presente' : 'Mancante',
        politico_nome: n.politico_nome,
        politico_cognome: n.politico_cognome
      })));
    }

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
    
    // Combina tutte le notifiche e ordina per data_creazione (più recenti prima)
    const allNotifiche = [...comunicazioni, ...segnalazioni].sort((a, b) => {
      // Usa data_creazione come priorità principale, poi data come fallback
      const dateA = a.data_creazione ? new Date(a.data_creazione) : (a.data ? new Date(a.data) : new Date(0));
      const dateB = b.data_creazione ? new Date(b.data_creazione) : (b.data ? new Date(b.data) : new Date(0));
      return dateB.getTime() - dateA.getTime(); // Ordine decrescente (più recenti prima)
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

// GET /api/notifiche/preferenze - Ottieni preferenze notifiche utente
router.get('/preferenze', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Recupera le preferenze dalla nuova tabella notifiche_preferenze
    const result = await pool.query(
      `SELECT eurodeputato, senatore, deputato, consigliere_regionale, consigliere_comunale,
              attivisti, demos, scuola, animali, organizzazioni, updated_at
       FROM notifiche_preferenze
       WHERE user_id = $1`,
      [user_id]
    );
    
    if (result.rows.length === 0) {
      // Se non esistono preferenze, crea record con valori di default
      const defaultResult = await pool.query(
        `INSERT INTO notifiche_preferenze (user_id, eurodeputato, senatore, deputato, 
                                          consigliere_regionale, consigliere_comunale, 
                                          attivisti, demos, scuola, animali, organizzazioni)
         VALUES ($1, false, false, false, false, false, false, false, false, true, false)
         RETURNING eurodeputato, senatore, deputato, consigliere_regionale, consigliere_comunale,
                   attivisti, demos, scuola, animali, organizzazioni, updated_at`,
        [user_id]
      );
      
      const prefs = defaultResult.rows[0];
      return res.json({
        success: true,
        data: {
          user_id,
          preferenze: {
            eurodeputato: prefs.eurodeputato,
            senatore: prefs.senatore,
            deputato: prefs.deputato,
            consigliere_regionale: prefs.consigliere_regionale,
            consigliere_comunale: prefs.consigliere_comunale,
            attivisti: prefs.attivisti,
            demos: prefs.demos,
            scuola: prefs.scuola,
            animali: prefs.animali,
            organizzazioni: prefs.organizzazioni
          },
          updated_at: prefs.updated_at
        }
      });
    }
    
    const prefs = result.rows[0];
    
    res.json({
      success: true,
      data: {
        user_id,
        preferenze: {
          eurodeputato: prefs.eurodeputato ?? false,
          senatore: prefs.senatore ?? false,
          deputato: prefs.deputato ?? false,
          consigliere_regionale: prefs.consigliere_regionale ?? false,
          consigliere_comunale: prefs.consigliere_comunale ?? false,
          attivisti: prefs.attivisti ?? false,
          demos: prefs.demos ?? false,
          scuola: prefs.scuola ?? false,
          animali: prefs.animali ?? true,
          organizzazioni: prefs.organizzazioni ?? false
        },
        updated_at: prefs.updated_at
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero preferenze notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
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
    
    // Estrai i valori (gestisci sia booleani che stringhe)
    const eurodeputato = preferenze.eurodeputato === true || preferenze.eurodeputato === 'true';
    const senatore = preferenze.senatore === true || preferenze.senatore === 'true';
    const deputato = preferenze.deputato === true || preferenze.deputato === 'true';
    const consigliere_regionale = preferenze.consigliere_regionale === true || preferenze.consigliere_regionale === 'true';
    const consigliere_comunale = preferenze.consigliere_comunale === true || preferenze.consigliere_comunale === 'true';
    const attivisti = preferenze.attivisti === true || preferenze.attivisti === 'true';
    const demos = preferenze.demos === true || preferenze.demos === 'true';
    const scuola = preferenze.scuola === true || preferenze.scuola === 'true';
    const animali = preferenze.animali !== false && preferenze.animali !== 'false';
    const organizzazioni = preferenze.organizzazioni === true || preferenze.organizzazioni === 'true';
    
    // Usa UPSERT per inserire o aggiornare le preferenze nella nuova tabella
    const result = await pool.query(
      `INSERT INTO notifiche_preferenze (user_id, eurodeputato, senatore, deputato, 
                                         consigliere_regionale, consigliere_comunale, 
                                         attivisti, demos, scuola, animali, organizzazioni)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         eurodeputato = EXCLUDED.eurodeputato,
         senatore = EXCLUDED.senatore,
         deputato = EXCLUDED.deputato,
         consigliere_regionale = EXCLUDED.consigliere_regionale,
         consigliere_comunale = EXCLUDED.consigliere_comunale,
         attivisti = EXCLUDED.attivisti,
         demos = EXCLUDED.demos,
         scuola = EXCLUDED.scuola,
         animali = EXCLUDED.animali,
         organizzazioni = EXCLUDED.organizzazioni,
         updated_at = NOW()
       RETURNING user_id, eurodeputato, senatore, deputato, consigliere_regionale, 
                 consigliere_comunale, attivisti, demos, scuola, animali, organizzazioni, updated_at`,
      [user_id, eurodeputato, senatore, deputato, consigliere_regionale, consigliere_comunale, 
       attivisti, demos, scuola, animali, organizzazioni]
    );
    
    if (result.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Errore nel salvataggio delle preferenze'
      });
    }
    
    const savedPrefs = result.rows[0];
    
    console.log(`✅ Preferenze notifiche salvate per utente ${user_id}:`, {
      eurodeputato: savedPrefs.eurodeputato,
      senatore: savedPrefs.senatore,
      deputato: savedPrefs.deputato,
      consigliere_regionale: savedPrefs.consigliere_regionale,
      consigliere_comunale: savedPrefs.consigliere_comunale,
      attivisti: savedPrefs.attivisti,
      demos: savedPrefs.demos,
      scuola: savedPrefs.scuola,
      animali: savedPrefs.animali,
      organizzazioni: savedPrefs.organizzazioni
    });
    
    res.json({
      success: true,
      message: 'Preferenze salvate con successo',
      data: {
        user_id: savedPrefs.user_id,
        preferenze: {
          eurodeputato: savedPrefs.eurodeputato,
          senatore: savedPrefs.senatore,
          deputato: savedPrefs.deputato,
          consigliere_regionale: savedPrefs.consigliere_regionale,
          consigliere_comunale: savedPrefs.consigliere_comunale,
          attivisti: savedPrefs.attivisti,
          demos: savedPrefs.demos,
          scuola: savedPrefs.scuola,
          animali: savedPrefs.animali,
          organizzazioni: savedPrefs.organizzazioni
        },
        updated_at: savedPrefs.updated_at
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
