const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { notificationSchemaCache } = require('../services/notificationSchemaCache');
const { verifyToken, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// ===== ENDPOINTS PER NOTIFICHE =====

// GET /api/notifiche - Lista notifiche dell'utente autenticato
router.get('/', verifyToken, async (req, res) => {
  try {
    // L'identità arriva esclusivamente dal token verificato.
    // Qualsiasi user_id passato dal client viene ignorato.
    const user_id = req.user.id;

    // Recupera informazioni utente (rappresentanti scelti per filtrare le notifiche)
    const userInfoResult = await pool.query(
      `SELECT comune_residenza, rappresentante_camera, rappresentante_senato, rappresentante_comune 
       FROM users WHERE id = $1`,
      [user_id]
    );
    
    const userInfo = userInfoResult.rows[0] || null;
    // I privilegi admin derivano dal ruolo dell'utente autenticato, non da un ID fornito dal client.
    const isAdmin = Boolean(req.user?.isAdmin);
    const userComuneResidenza = userInfo ? userInfo.comune_residenza : null;
    
    let votiComuniResult, demosResult, comunaliResult, votiParlamentoResult, opinionChangesResult;
    
    // Recupera da notifiche_voti_parlamento (solo per i rappresentanti scelti dall'utente)
    try {
      const rappresentantiIds = [];
      if (userInfo && userInfo.rappresentante_camera) {
        rappresentantiIds.push(userInfo.rappresentante_camera);
      }
      if (userInfo && userInfo.rappresentante_senato) {
        rappresentantiIds.push(userInfo.rappresentante_senato);
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
      } else {
        votiParlamentoResult = { rows: [] };
      }
    } catch (err) {
      console.error('NOTIF_PARLIAMENT_FAILED');
      votiParlamentoResult = { rows: [] };
    }
    
    // Recupera da notifiche_voti_comuni (solo se l'utente ha scelto un rappresentante comunale)
    try {
      const rappresentanteComuneId = userInfo && userInfo.rappresentante_comune ? userInfo.rappresentante_comune : null;
      
      if (!rappresentanteComuneId) {
        votiComuniResult = { rows: [] };
      } else {
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
          WHERE id_utente = $1::uuid
          ORDER BY COALESCE(data_creazione, CURRENT_TIMESTAMP) DESC
          LIMIT 50
        `;
        votiComuniResult = await pool.query(baseQuery, [rappresentanteComuneId]);
      }
      
      // Se ci sono risultati, recupera i dati di tutti i politici con 1-2 query batch (evita N+1)
      if (votiComuniResult.rows.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const politicoIds = [];
        const politicoNames = [];
        const seenIds = new Set();
        const seenNames = new Set();
        for (const n of votiComuniResult.rows) {
          if (!n.politico) continue;
          const p = String(n.politico).trim();
          if (uuidRegex.test(p)) {
            if (!seenIds.has(p)) { seenIds.add(p); politicoIds.push(p); }
          } else {
            if (!seenNames.has(p)) { seenNames.add(p); politicoNames.push(p); }
          }
        }
        const politicoByKey = new Map(); // chiave: id (uuid) o nome "Nome Cognome"
        if (politicoIds.length > 0) {
          try {
            const byId = await pool.query(
              'SELECT id, nome, cognome, avatar_config, genere FROM users WHERE id = ANY($1::uuid[])',
              [politicoIds]
            );
            for (const row of byId.rows) {
              politicoByKey.set(row.id, row);
            }
          } catch (e) {
            console.warn('NOTIF_POLITICIAN_UUID_FAILED');
          }
        }
        if (politicoNames.length > 0) {
          try {
            const byName = await pool.query(
              `SELECT id, nome, cognome, avatar_config, genere FROM users 
               WHERE (nome || ' ' || cognome) = ANY($1::text[]) OR nome = ANY($1::text[]) OR cognome = ANY($1::text[])`,
              [politicoNames]
            );
            for (const row of byName.rows) {
              const key = `${row.nome || ''} ${row.cognome || ''}`.trim();
              if (key && !politicoByKey.has(key)) politicoByKey.set(key, row);
              if (row.id && !politicoByKey.has(row.id)) politicoByKey.set(row.id, row);
            }
          } catch (e) {
            console.warn('NOTIF_POLITICIAN_NAME_FAILED');
          }
        }
        for (const notifica of votiComuniResult.rows) {
          if (!notifica.politico) continue;
          const p = String(notifica.politico).trim();
          const politico = politicoByKey.get(p) || politicoByKey.get(p.split(' ').slice(0, 2).join(' '));
          if (politico) {
            notifica.politico_avatar_config = politico.avatar_config;
            notifica.politico_nome = politico.nome;
            notifica.politico_cognome = politico.cognome;
            notifica.politico_genere = politico.genere;
          }
        }
      } else {
        console.warn('⚠️ Nessuna notifica voti comuni trovata nella tabella');
      }
    } catch (err) {
      console.error('NOTIF_LOCAL_VOTES_FAILED');
      votiComuniResult = { rows: [] };
    }
    
    // Recupera da notifiche_demos senza interrogare information_schema a ogni GET.
    // Se lo schema non è disponibile, il fallback resta isolato a questa sorgente.
    try {
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
        WHERE (id_utente IS NULL OR id_utente = $1::uuid)
        ORDER BY COALESCE(data_creazione, (COALESCE(data, CURRENT_DATE)::timestamp)) DESC
        LIMIT 50
      `, [user_id]);
    } catch (err) {
      console.error('NOTIF_DEMOS_FAILED');
      demosResult = { rows: [] };
    }

    // Cambi di Opinione di Politici/Candidati sostenuti correntemente dall'utente.
    try {
      opinionChangesResult = await pool.query(
        `SELECT
           pon.id,
           pon.subject_user_id AS id_utente,
           ('Cambio di posizione: ' || pon.opinion_text) AS titolo,
           (CASE pon.previous_value
              WHEN 'f' THEN 'Favorevole'
              WHEN 'c' THEN 'Contrario'
              WHEN 'i' THEN 'Non lo so'
            END || ' → ' ||
            CASE pon.new_value
              WHEN 'f' THEN 'Favorevole'
              WHEN 'c' THEN 'Contrario'
              WHEN 'i' THEN 'Non lo so'
            END) AS testo,
           pon.created_at AS data,
           pon.created_at AS data_creazione,
           'political_opinion_notifications' AS tabella_origine,
           subject.nome AS politico_nome,
           subject.cognome AS politico_cognome,
           subject.avatar_config AS politico_avatar_config,
           subject.genere AS politico_genere,
           pon.opinion_id,
           pon.opinion_text
         FROM political_opinion_notifications pon
         JOIN users subject ON subject.id = pon.subject_user_id
         WHERE pon.recipient_user_id = $1
         ORDER BY pon.created_at DESC
         LIMIT 50`,
        [user_id]
      );
    } catch (err) {
      if (err?.code !== '42P01') {
        console.error('NOTIF_OPINION_CHANGES_FAILED');
      }
      opinionChangesResult = { rows: [] };
    }

    // Recupera da notifiche_comunali (gestisce sia struttura nuova che vecchia)
    try {
      // Cache dei soli nomi delle colonne, mai di contenuto o identità utenti.
      const existingColumns = await notificationSchemaCache.columns(pool, 'notifiche_comunali');
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
      
      comunaliResult = await pool.query(query);
    } catch (err) {
      if (err?.code === '42703' || err?.code === '42P01') {
        notificationSchemaCache.invalidate('notifiche_comunali');
      }
      console.error('NOTIF_MUNICIPAL_FAILED');
      comunaliResult = { rows: [] };
    }
    
    // Recupera da notifiche_avvistamenti
    let avvistamentiResult = { rows: [] };
    try {
      // Per un utente senza comune nessun avvistamento può essere mostrato:
      // evitare tutte le query di metadata e dati in questo caso.
      if (userComuneResidenza) {
        const availableColumns = await notificationSchemaCache.columns(pool, 'notifiche_avvistamenti');
        if (availableColumns.length > 0) {
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
          console.error('NOTIF_INVALID_QUERY_SHAPE');
          throw new Error('La query contiene ancora un riferimento alla colonna "testo"');
        }
        avvistamentiResult = await pool.query(queryText, queryParams);
        }
      }
    } catch (err) {
      if (err?.code === '42703' || err?.code === '42P01') {
        notificationSchemaCache.invalidate('notifiche_avvistamenti');
      }
      console.error('NOTIF_SIGHTINGS_FAILED');
      avvistamentiResult = { rows: [] };
    }
    
    // Combina tutte le notifiche
    const votiComuniRows = votiComuniResult?.rows || [];
    const demosRows = demosResult?.rows || [];
    const comunaliRows = comunaliResult?.rows || [];
    const avvistamentiRows = avvistamentiResult?.rows || [];
    const votiParlamentoRows = votiParlamentoResult?.rows || [];
    const opinionChangesRows = opinionChangesResult?.rows || [];
    
    const allNotificheRaw = [
      ...votiComuniRows.map(n => ({ ...n, tipo_notifica: 'voto_comune' })),
      ...votiParlamentoRows.map(n => ({ ...n, tipo_notifica: 'voto_parlamento' })),
      ...demosRows.map(n => ({ ...n, tipo_notifica: 'demos' })),
      ...opinionChangesRows.map(n => ({ ...n, tipo_notifica: 'cambio_opinione' })),
      ...comunaliRows.map(n => ({ ...n, tipo_notifica: 'comunale' })),
      ...avvistamentiRows.map(n => ({ ...n, tipo_notifica: 'avvistamento' }))
    ];
    
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
          // Per voto_comune: "Il consigliere comunale" / "La consigliera comunale" in base al genere
          const genere = c.politico_genere; // "d" = donna, "u" = uomo, "a" = altro/null
          if (genere === 'd') {
            articoloETitolo = 'La consigliera comunale';
          } else {
            articoloETitolo = 'Il consigliere comunale';
          }
        }
        
        // Abbrevia il titolo della votazione (es: "Disegno di legge n. 1718..." -> "DDL 1718")
        let titoloVotazioneAbbreviato = titoloVotazione;
        if (c.tipo_notifica === 'voto_parlamento') {
          // Pattern per "Disegno di legge n. XXXX"
          const patternDDL = /disegno\s+di\s+legge\s+n\.?\s*(\d+)/i;
          const matchDDL = titoloVotazione.match(patternDDL);
          if (matchDDL) {
            titoloVotazioneAbbreviato = `DDL ${matchDDL[1]}`;
          } else {
            // Pattern per "DDL XXXX" (già formato)
            const patternDDLGià = /^DDL\s+(\d+)/i;
            if (titoloVotazione.match(patternDDLGià)) {
              titoloVotazioneAbbreviato = titoloVotazione.match(patternDDLGià)[0];
            } else {
              // Pattern per "Decreto-legge n. XXXX" o "DL n. XXXX"
              const patternDL = /(?:decreto\s*[-]?\s*legge|DL|D\.L\.)\s+n\.?\s*(\d+)/i;
              const matchDL = titoloVotazione.match(patternDL);
              if (matchDL) {
                titoloVotazioneAbbreviato = `DL ${matchDL[1]}`;
              } else {
                // Pattern per "Mozione n. XXXX"
                const patternMozione = /mozione\s+n\.?\s*(\d+)/i;
                const matchMozione = titoloVotazione.match(patternMozione);
                if (matchMozione) {
                  titoloVotazioneAbbreviato = `Mozione ${matchMozione[1]}`;
                }
              }
            }
          }
        }
        
        // Evidenzia nome, voto e titolo votazione con HTML
        titolo = `${articoloETitolo} <span class="font-bold underline">${nomePolitico}</span> ha votato <span class="font-bold underline">${voto}</span> a <span class="font-bold underline">${titoloVotazioneAbbreviato}</span>`;
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
        uri_votazione: c.uri_votazione || null, // URI per aprire il dialog con i dettagli della votazione
        opinion_id: c.opinion_id || null,
        opinion_text: c.opinion_text || null
      };
    });
    
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
    console.error('NOTIF_FEED_FAILED');
    
    // Se è un errore di connessione database, restituisci un messaggio più specifico
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({
        success: false,
        error: 'Errore connessione database'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
    });
  }
});

// Endpoint rimossi: non serve più marcare le notifiche come lette

// POST /api/notifiche - Crea nuova notifica
router.post('/', verifyToken, requireAdmin, async (req, res) => {
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
    console.error('NOTIF_CREATE_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/notifiche/preferenze - sola lettura.
// Non creare record durante GET: rende l'apertura della pagina idempotente e
// riduce scritture, transazioni e carico PostgreSQL sul piano gratuito.
// Per utenti senza riga, manteniamo gli stessi default della precedente INSERT.
// La prima scrittura avviene soltanto nella POST esplicita.
const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  eurodeputato: false,
  senatore: false,
  deputato: false,
  consigliere_regionale: false,
  consigliere_comunale: false,
  attivisti: false,
  demos: false,
  scuola: false,
  animali: true,
  organizzazioni: false
});

router.get('/preferenze', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await pool.query(
      `SELECT eurodeputato, senatore, deputato, consigliere_regionale, consigliere_comunale,
              attivisti, demos, scuola, animali, organizzazioni, updated_at
       FROM notifiche_preferenze
       WHERE user_id = $1`,
      [user_id]
    );

    const prefs = result.rows[0] || null;
    const preferenze = Object.fromEntries(
      Object.entries(DEFAULT_NOTIFICATION_PREFERENCES).map(([key, defaultValue]) => [
        key, prefs?.[key] ?? defaultValue
      ])
    );

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        user_id,
        preferenze,
        updated_at: prefs?.updated_at ?? null
      }
    });
  } catch (error) {
    console.error('NOTIF_PREFERENCES_READ_FAILED');
    return res.status(500).json({
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
    
    console.info('NOTIF_PREFERENCES_SAVED');
    
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
    console.error('NOTIF_PREFERENCES_WRITE_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
    });
  }
});

// GET /api/notifiche/ultima - Ottieni l'ultima notifica (la più recente)
router.get('/ultima', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/notifiche/ultima - Richiesta ultima notifica');
    
    const userId = req.user.id;
    
    // Usa gli stessi soggetti scelti dal feed principale; nessun fallback territoriale legacy.
    const userResult = await pool.query(
      'SELECT rappresentante_camera, rappresentante_senato, rappresentante_comune FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const rappresentanteCamera = userResult.rows[0].rappresentante_camera;
    const rappresentanteSenato = userResult.rows[0].rappresentante_senato;
    const rappresentanteComune = userResult.rows[0].rappresentante_comune;
    
    let comunicazioni = [];
    
    // Ultimo voto comunale: soltanto del rappresentante comunale scelto dall'utente.
    if (rappresentanteComune) {
      try {
        const votiComuniResult = await pool.query(`
          SELECT id, id_utente, titolo, testo,
                 COALESCE(data_creazione, CURRENT_TIMESTAMP) AS data_creazione,
                 'notifiche_voti_comuni' AS tabella_origine
          FROM notifiche_voti_comuni
          WHERE id_utente = $1::uuid
          ORDER BY COALESCE(data_creazione, CURRENT_TIMESTAMP) DESC
          LIMIT 1
        `, [rappresentanteComune]);
        if (votiComuniResult.rows.length > 0) {
          comunicazioni.push({
            id: votiComuniResult.rows[0].id,
            titolo: votiComuniResult.rows[0].titolo,
            messaggio: votiComuniResult.rows[0].testo,
            data_creazione: votiComuniResult.rows[0].data_creazione,
            tipo_notifica: 'voto_comune',
            tabella_origine: 'notifiche_voti_comuni'
          });
        }
      } catch (err) {
        console.error('NOTIF_LATEST_LOCAL_FAILED');
      }
    }
    
    // Recupera da notifiche_demos
    try {
      const demosResult = await pool.query(`
        SELECT 
          id,
          id_utente,
          titolo,
          testo,
          COALESCE(data, CURRENT_DATE) as data,
          data_creazione,
          'notifiche_demos' as tabella_origine
        FROM notifiche_demos
        WHERE (id_utente IS NULL OR id_utente = $1::uuid)
        ORDER BY COALESCE(data_creazione, (COALESCE(data, CURRENT_DATE)::timestamp)) DESC
        LIMIT 1
      `, [userId]);
      
      if (demosResult.rows.length > 0) {
        comunicazioni.push({
          id: demosResult.rows[0].id,
          titolo: demosResult.rows[0].titolo,
          messaggio: demosResult.rows[0].testo,
          data_creazione: demosResult.rows[0].data_creazione,
          tipo_notifica: 'notifica_demos',
          tabella_origine: 'notifiche_demos'
        });
      }
    } catch (err) {
      console.error('NOTIF_LATEST_DEMOS_FAILED');
    }
    
    // Recupera da notifiche_voti_parlamento (se l'utente ha rappresentanti scelti)
    if (rappresentanteCamera || rappresentanteSenato) {
      try {
        const rappresentantiIds = [];
        if (rappresentanteCamera) rappresentantiIds.push(rappresentanteCamera);
        if (rappresentanteSenato) rappresentantiIds.push(rappresentanteSenato);
        
        if (rappresentantiIds.length > 0) {
          const votiParlamentoResult = await pool.query(`
            SELECT 
              id,
              id_utente,
              titolo,
              testo,
              COALESCE(data, CURRENT_DATE) as data,
              COALESCE(data_creazione, CURRENT_TIMESTAMP) as data_creazione,
              voto,
              camera,
              politico,
              'notifiche_voti_parlamento' as tabella_origine
            FROM notifiche_voti_parlamento
            WHERE id_utente = ANY($1::uuid[])
            ORDER BY COALESCE(data_creazione, CURRENT_TIMESTAMP) DESC
            LIMIT 1
          `, [rappresentantiIds]);
          
          if (votiParlamentoResult.rows.length > 0) {
            comunicazioni.push({
              id: votiParlamentoResult.rows[0].id,
              titolo: votiParlamentoResult.rows[0].titolo,
              messaggio: votiParlamentoResult.rows[0].testo,
              data_creazione: votiParlamentoResult.rows[0].data_creazione,
              tipo_notifica: 'voto_parlamento',
              tabella_origine: 'notifiche_voti_parlamento'
            });
          }
        }
      } catch (err) {
        console.error('NOTIF_LATEST_PARLIAMENT_FAILED');
      }
    }
    
    // Ultimo cambio di Opinione destinato specificamente all'utente.
    try {
      const opinionChangeResult = await pool.query(
        `SELECT
           pon.id,
           pon.created_at,
           pon.opinion_text,
           pon.previous_value,
           pon.new_value,
           subject.nome,
           subject.cognome
         FROM political_opinion_notifications pon
         JOIN users subject ON subject.id = pon.subject_user_id
         WHERE pon.recipient_user_id = $1
         ORDER BY pon.created_at DESC
         LIMIT 1`,
        [userId]
      );
      if (opinionChangeResult.rows.length > 0) {
        const row = opinionChangeResult.rows[0];
        const label = (value) => value === 'f' ? 'Favorevole' : value === 'c' ? 'Contrario' : 'Non lo so';
        comunicazioni.push({
          id: row.id,
          titolo: `${row.nome || 'Politico'} ${row.cognome || ''} ha cambiato posizione`,
          messaggio: `${row.opinion_text}: ${label(row.previous_value)} → ${label(row.new_value)}`,
          data_creazione: row.created_at,
          tipo_notifica: 'cambio_opinione',
          tabella_origine: 'political_opinion_notifications'
        });
      }
    } catch (err) {
      if (err?.code !== '42P01') {
        console.error('NOTIF_LATEST_OPINION_FAILED');
      }
    }

    // Ordina per data_creazione (più recenti prima) e prendi la prima
    comunicazioni.sort((a, b) => {
      const dateA = a.data_creazione ? new Date(a.data_creazione) : new Date(0);
      const dateB = b.data_creazione ? new Date(b.data_creazione) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (comunicazioni.length === 0) {
      console.log('📭 Nessuna notifica trovata');
      return res.json({
        success: true,
        data: null,
        message: 'Nessuna notifica trovata'
      });
    }
    
    const ultimaNotifica = comunicazioni[0];
    console.info('NOTIF_LATEST_FOUND');
    
    res.json({
      success: true,
      data: ultimaNotifica
    });
  } catch (error) {
    console.error('NOTIF_LATEST_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
