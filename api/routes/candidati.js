const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');
const { compressRegione, REGIONI_DB_TO_FRONTEND } = require('../utils/regioniUtils');

const router = express.Router();

const hasAnsweredOpinions = (opinions) =>
  Object.values(opinions || {}).some(value => value !== null && value !== undefined);

// GET /api/candidati - Ottieni selezioni candidati dell'utente corrente
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/candidati - Richiesta ricevuta per userId:', userId);
    
    // Ottieni i dati dell'utente con le selezioni candidati
    const userQuery = `
      SELECT 
        id,
        nome,
        cognome,
        
        ruolo,
        status,
        avatar_config,
        candidato_europeo,
        candidato_camera,
        candidato_senato,
        candidato_regionale,
        candidato_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('🔍 DEBUG - Utente trovato:', user.nome, user.cognome);
    
    // Inizializza le strutture dati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Campi candidati da controllare
    const campiCandidati = [
      { campo: 'candidato_europeo', categoria: 'europeo' },
      { campo: 'candidato_camera', categoria: 'camera' },
      { campo: 'candidato_senato', categoria: 'senato' },
      { campo: 'candidato_regionale', categoria: 'regione' },
      { campo: 'candidato_comune', categoria: 'comune' }
    ];
    
    for (const { campo, categoria } of campiCandidati) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Cerca il candidato selezionato (rimuoviamo il filtro ruolo per trovare tutti gli utenti)
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            
            ruolo,
            status,
            avatar_config,
            grado_candidatura
          FROM users
          WHERE id::text = $1
        `;
        
        console.log(`🔍 DEBUG - Cercando candidato con ID: ${candidatoId} per categoria: ${categoria}`);
        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);
        console.log(`🔍 DEBUG - Risultato query candidato:`, candidatoResult.rows.length, 'righe trovate');
        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;
          console.log(`🔍 DEBUG - Candidato selezionato per ${categoria}:`, candidato.nome, candidato.cognome);
        } else {
          console.log(`❌ DEBUG - Nessun candidato trovato per ID: ${candidatoId} e categoria: ${categoria}`);
        }
      }
    }
    
    console.log('🔍 DEBUG - Candidati selezionati finali:', candidatiSelezionati);
    console.log('🔍 DEBUG - ID Map finale:', idMap);
    
    res.json({
      success: true,
      data: {
        candidati: candidatiSelezionati,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare selezioni candidati utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni candidati utente'
    });
  }
});

// GET /api/candidati/sostenitori - Ottieni sostenitori candidati di un utente
router.get('/sostenitori', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    if (String(req.userId) !== String(sostenuto_id) && req.userRole !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato'
      });
    }

    // Trova tutti gli utenti che hanno scelto questo utente come candidato
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.data_nascita,
        u.genere,
        u.regione_residenza,
        u.provincia_residenza,
        u.comune_residenza,
        u.created_at,
        CASE 
          WHEN u.candidato_europeo = $1 THEN 'Candidato Europeo'
          WHEN u.candidato_camera = $1 THEN 'Candidato Camera'
          WHEN u.candidato_senato = $1 THEN 'Candidato Senato'
          WHEN u.candidato_regionale = $1 THEN 'Candidato Regionale'
          WHEN u.candidato_comune = $1 THEN 'Candidato Comunale'
        END as supporter_role
      FROM users u
      WHERE (
        u.candidato_europeo = $1 OR
        u.candidato_camera = $1 OR
        u.candidato_senato = $1 OR
        u.candidato_regionale = $1 OR
        u.candidato_comune = $1
      )
      AND u.status = 'a'
      ORDER BY u.created_at DESC
    `, [sostenuto_id]);

    const sostenitori = result.rows;

    res.json({
      success: true,
      data: {
        sostenitori: req.userRole === 'AD' ? sostenitori : [],
        count: sostenitori.length
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare sostenitori candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sostenitori candidati'
    });
  }
});

// GET /api/candidati/europei - Candidati europei votabili nella circoscrizione dell'elettore (regione_residenza)
router.get('/europei', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('🔍 DEBUG /api/candidati/europei - Richiesta per userId:', userId);

    const userResult = await pool.query(
      'SELECT regione_residenza FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    let regioneResidenza = userResult.rows[0].regione_residenza;
    if (!regioneResidenza) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessuna regione di residenza: non è possibile determinare la circoscrizione europea.'
      });
    }
    // Normalizza: se è salvata come nome (es. "Toscana"), converti in codice (es. "TO") per unita_elettorale_territorio
    const codiciRegioni = Object.keys(REGIONI_DB_TO_FRONTEND);
    if (!codiciRegioni.includes(regioneResidenza) && REGIONI_DB_TO_FRONTEND[regioneResidenza] === undefined) {
      const compressed = compressRegione(regioneResidenza);
      if (compressed) regioneResidenza = compressed;
    }

    const eventoResult = await pool.query(`
      SELECT id FROM eventi
      WHERE tipologia_evento = 'Elezioni' AND LOWER(TRIM(tipo_elezione)) = 'europee'
      ORDER BY giorno_inizio DESC NULLS LAST
      LIMIT 1
    `);
    if (eventoResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessun evento Elezioni Europee trovato.'
      });
    }
    const eventoId = eventoResult.rows[0].id;

    const unitaIdsResult = await pool.query(
      'SELECT id FROM unita_elettorale WHERE evento_id = $1',
      [eventoId]
    );
    const unitaIds = unitaIdsResult.rows.map(r => r.id);
    if (unitaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessuna unità elettorale per le Europee.'
      });
    }

    const territorioResult = await pool.query(
      `SELECT unita_elettorale_id FROM unita_elettorale_territorio
       WHERE regione_codice = $1 AND unita_elettorale_id = ANY($2)`,
      [regioneResidenza, unitaIds]
    );
    const unitaIdsCircoscrizione = territorioResult.rows.map(r => r.unita_elettorale_id);
    if (unitaIdsCircoscrizione.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessun candidato nella tua circoscrizione per le Europee.'
      });
    }

    const candidatiResult = await pool.query(`
      SELECT c.user_id
      FROM candidati c
      WHERE c.evento_id = $1 AND c.unita_elettorale_id = ANY($2)
    `, [eventoId, unitaIdsCircoscrizione]);
    const userIds = [...new Set(candidatiResult.rows.map(r => r.user_id))];
    if (userIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessun candidato trovato per la tua circoscrizione.'
      });
    }

    const candidatiQuery = `
      SELECT id, nome, cognome, ruolo, status, avatar_config, grado_candidatura
      FROM users
      WHERE id = ANY($1) AND ruolo IN ('C', 'CP')
      ORDER BY nome, cognome
    `;
    const candidatiRows = await pool.query(candidatiQuery, [userIds]);
    const candidati = candidatiRows.rows;

    const gradoDatabase = 'E';
    const gradoOpinioniResult = await pool.query(
      'SELECT id FROM opinioni_domande WHERE $1 = ANY(gradi_opinione)',
      [gradoDatabase]
    );
    const opinioniDelGrado = gradoOpinioniResult.rows.map(row => row.id);
    let userOpinions = {};
    if (opinioniDelGrado.length > 0) {
      const colonneQuery = opinioniDelGrado.join(', ');
      const userAnswersResult = await pool.query(
        `SELECT user_id, ${colonneQuery} FROM opinioni_risposte WHERE user_id = $1`,
        [userId]
      );
      if (userAnswersResult.rows.length > 0) {
        const userRow = userAnswersResult.rows[0];
        opinioniDelGrado.forEach(opinionId => {
          userOpinions[opinionId] = userRow[opinionId];
        });
      }
    }

    const candidatiConOpinioni = await Promise.all(candidati.map(async (candidato) => {
      try {
        const candidatoAnswersResult = await pool.query(
          'SELECT * FROM opinioni_risposte WHERE user_id = $1',
          [candidato.id]
        );
        const candidatoData = {};
        if (candidatoAnswersResult.rows.length > 0) {
          const row = candidatoAnswersResult.rows[0];
          Object.keys(row).forEach(key => {
            if (key !== 'user_id' && key !== 'fonti_opinioni') candidatoData[key] = row[key];
          });
        }
        let opinioniComuni = 0;
        Object.keys(userOpinions).forEach(opinionId => {
          const cv = candidatoData[opinionId];
          const uv = userOpinions[opinionId];
          if (cv != null && uv != null && cv === uv) opinioniComuni++;
        });
        return { ...candidato, opinioniComuni };
      } catch (err) {
        console.error('Errore opinioni per candidato', candidato.id, err);
        return { ...candidato, opinioniComuni: 0 };
      }
    }));

    const candidatiValutabili = hasAnsweredOpinions(userOpinions) ? candidatiConOpinioni : [];
    const candidatiOrdinati = candidatiValutabili
      .sort((a, b) => {
        if (b.opinioniComuni !== a.opinioniComuni) return b.opinioniComuni - a.opinioniComuni;
        return a.cognome.localeCompare(b.cognome);
      })
      .slice(0, 4);

    const candidatiMappati = candidatiOrdinati.map(c => ({
      ...c,
      opinioni_comuni: c.opinioniComuni || 0
    }));

    res.json({
      success: true,
      data: candidatiMappati,
      count: candidatiMappati.length,
      message: `Trovati ${candidatiMappati.length} candidati nella tua circoscrizione (Europee).`
    });
  } catch (error) {
    console.error('❌ Errore /api/candidati/europei:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare i candidati europei',
      message: 'Impossibile recuperare i candidati europei'
    });
  }
});

// GET /api/candidati/disponibili - Ottieni candidati disponibili per grado_candidatura
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado_candidatura } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Richiesta ricevuta:', { grado_candidatura, userId });
    
    if (!grado_candidatura) {
      return res.status(400).json({
        success: false,
        error: 'Parametro grado_candidatura richiesto'
      });
    }
    
    // Query per ottenere TUTTI gli utenti con ruolo "Candidato" o "Candidato Politico" 
    // e grado_candidatura corrispondente (senza LIMIT per calcolare opinioni comuni)
    const candidatiQuery = `
      SELECT 
        id,
        nome,
        cognome,
        
        ruolo,
        status,
        avatar_config,
        grado_candidatura
      FROM users
      WHERE ruolo IN ('C', 'CP')
        AND grado_candidatura = $1
      ORDER BY nome, cognome
    `;
    
    console.log('🔍 DEBUG - Query candidati:', candidatiQuery);
    console.log('🔍 DEBUG - Parametri:', [grado_candidatura]);
    
    const candidatiResult = await pool.query(candidatiQuery, [grado_candidatura]);
    const candidati = candidatiResult.rows;
    
        console.log('🔍 DEBUG - Candidati trovati:', candidati.length);
        candidati.forEach((candidato, index) => {
          console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome} (${candidato.ruolo})`);
        });
    
    // Calcola il conteggio reale delle opinioni comuni
    const candidatiConOpinioni = await Promise.all(candidati.map(async (candidato) => {
      try {
        // Ottieni le opinioni del candidato dalla tabella opinioni_risposte
        const candidatoAnswersQuery = `
          SELECT * FROM opinioni_risposte WHERE user_id = $1
        `;
        
        const candidatoAnswersResult = await pool.query(candidatoAnswersQuery, [candidato.id]);
        const candidatoData = {};
        
        if (candidatoAnswersResult.rows.length > 0) {
          const candidatoRow = candidatoAnswersResult.rows[0];
          // Mappa tutte le colonne di opinioni (escludendo user_id e fonti_opinioni)
          Object.keys(candidatoRow).forEach(key => {
            if (key !== 'user_id' && key !== 'fonti_opinioni') {
              candidatoData[key] = candidatoRow[key];
            }
          });
        }
        
        // Mappa il grado_candidatura del frontend al grado del database
        const gradoMapping = {
          'E': 'E',
          'C': 'N', 
          'S': 'N',
          'R': 'R',
          'CO': 'CO'
        };
        const gradoDatabase = gradoMapping[grado_candidatura] || grado_candidatura;
        
        // Ogni grado ha solo le sue opinioni specifiche
        
        // Ottieni le opinioni dell'utente corrente SOLO per il grado specifico
        let userOpinions = null;
        if (req.userId) {
        // Prima ottieni le opinioni del grado specifico
        const gradoOpinioniQuery = `
          SELECT id FROM opinioni_domande WHERE $1 = ANY(gradi_opinione)
        `;
        const gradoOpinioniResult = await pool.query(gradoOpinioniQuery, [gradoDatabase]);
        const opinioniDelGrado = gradoOpinioniResult.rows.map(row => row.id);
        
        console.log(`🔍 DEBUG ${grado_candidatura} - Grado database: ${gradoDatabase}, Opinion trovate: ${opinioniDelGrado.length}`);
        
        
          
          if (opinioniDelGrado.length > 0) {
            // Costruisci la query dinamica per le colonne del grado specifico
            const colonneQuery = opinioniDelGrado.join(', ');
            const userAnswersQuery = `
              SELECT user_id, ${colonneQuery} FROM opinioni_risposte WHERE user_id = $1
            `;
            
            const userAnswersResult = await pool.query(userAnswersQuery, [req.userId]);
            userOpinions = {};
            
            if (userAnswersResult.rows.length > 0) {
              const userRow = userAnswersResult.rows[0];
              // Mappa solo le opinioni del grado specifico
              opinioniDelGrado.forEach(opinionId => {
                userOpinions[opinionId] = userRow[opinionId];
              });
            }
          }
        }
        
        if (!userOpinions) {
          return { ...candidato, opinioniComuni: 0 };
        }
        
        // Calcola opinioni comuni confrontando SOLO le opinioni del grado specifico
        let opinioniComuni = 0;
        
        if (userOpinions && Object.keys(userOpinions).length > 0) {
          // Confronta solo le opinioni del grado specifico
          Object.keys(userOpinions).forEach(opinionId => {
            const candidatoValue = candidatoData[opinionId];
            const userValue = userOpinions[opinionId];
            
            console.log(`🔍 DEBUG - Confronto opinione ${opinionId}: candidato=${candidatoValue}, user=${userValue}`);
            
            // Conta come opinione comune SOLO se:
            // 1. Entrambi hanno risposto (non null)
            // 2. Le risposte sono identiche
            if (candidatoValue !== null && userValue !== null && candidatoValue === userValue) {
              opinioniComuni++;
              console.log(`✅ OPINIONE COMUNE (${grado_candidatura}): ${opinionId} = "${candidatoValue}"`);
            }
          });
        }
        
           return { ...candidato, opinioniComuni };
      } catch (error) {
        console.error('❌ Errore nel calcolo opinioni comuni per candidato:', candidato.id, error);
        return { ...candidato, opinioniComuni: 0 };
      }
    }));
    
    // Ordina per opinioni comuni (decrescente) e poi per cognome
    const candidatiValutabili = hasAnsweredOpinions(userOpinions) ? candidatiConOpinioni : [];
    const candidatiOrdinati = candidatiValutabili
      .sort((a, b) => {
        if (b.opinioniComuni !== a.opinioniComuni) {
          return b.opinioniComuni - a.opinioniComuni;
        }
        return a.cognome.localeCompare(b.cognome);
      })
      .slice(0, 4);
    
    // Debug temporaneo per vedere se opinioniComuni è presente
    console.log('🔍 DEBUG - Candidati finali:');
    candidatiOrdinati.forEach((candidato, index) => {
      console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome}: opinioniComuni=${candidato.opinioniComuni}`);
    });
    
    // Mappa opinioniComuni a opinioni_comuni per compatibilità con il frontend
    const candidatiMappati = candidatiOrdinati.map(candidato => ({
      ...candidato,
      opinioni_comuni: candidato.opinioniComuni || 0
    }));
    
    res.json({
      success: true,
      data: candidatiMappati,
      count: candidatiMappati.length,
      message: `Trovati ${candidatiMappati.length} candidati più compatibili per grado_candidatura: ${grado_candidatura}`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i candidati'
    });
  }
});

// PUT /api/candidati/seleziona-candidato - Seleziona candidato per categoria
router.put('/seleziona-candidato', verifyToken, async (req, res) => {
  try {
    console.log('🎯 PUT /api/candidati/seleziona-candidato - Selezione candidato');
    
    const { campo, candidatoId } = req.body;
    const userId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🔍 DEBUG - userId:', userId);
    console.log('🔍 DEBUG - campo:', campo);
    console.log('🔍 DEBUG - candidatoId:', candidatoId);
    
    // Verifica che il campo sia valido per le selezioni di candidati
    const validFields = ['test_europeo', 'test_camera', 'test_senato', 'test_regionale', 'test_comune'];
    if (!validFields.includes(campo)) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido per le selezioni di candidati'
      });
    }
    
    // Mappa i campi test ai campi reali del database
    const fieldMapping = {
      'test_europeo': 'candidato_europeo',
      'test_camera': 'candidato_camera', 
      'test_senato': 'candidato_senato',
      'test_regionale': 'candidato_regionale',
      'test_comune': 'candidato_comune'
    };
    
    const realField = fieldMapping[campo];
    if (!realField) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido per le selezioni di candidati'
      });
    }
    
    // Aggiorna il campo del candidato
    const query = `UPDATE users SET ${realField} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [candidatoId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Candidato selezionato con successo');
    
    res.json({
      success: true,
      message: 'Candidato selezionato con successo',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore durante la selezione candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/candidati/selezioni - Ottieni selezioni di candidati dell'utente
router.get('/selezioni', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/candidati/selezioni - Richiesta selezioni candidati');
    const userId = req.userId;
    console.log('🔍 DEBUG - userId:', userId);
    
    // Ottieni le selezioni di candidati dell'utente
    const userQuery = `
      SELECT 
        candidato_europeo,
        candidato_camera,
        candidato_senato,
        candidato_regionale,
        candidato_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0] || {};
    
    console.log('🔍 DEBUG Frontend - Utente selezioni candidati:', user);
    
    // Ottieni i dettagli dei candidati selezionati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Lista dei campi candidati
    const campiCandidati = [
      { campo: 'candidato_europeo', categoria: 'europeo' },
      { campo: 'candidato_camera', categoria: 'camera' },
      { campo: 'candidato_senato', categoria: 'senato' },
      { campo: 'candidato_regionale', categoria: 'regione' },
      { campo: 'candidato_comune', categoria: 'comune' }
    ];
    
    for (const { campo, categoria } of campiCandidati) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Cerca il candidato selezionato (rimuoviamo i filtri per trovare tutti gli utenti)
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            
            ruolo,
            status,
            avatar_config
          FROM users
          WHERE id::text = $1
        `;
        
        console.log(`🔍 DEBUG - Cercando candidato con ID: ${candidatoId} per categoria: ${categoria}`);
        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);
        console.log(`🔍 DEBUG - Risultato query candidato:`, candidatoResult.rows.length, 'righe trovate');
        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;
          console.log(`🔍 DEBUG Frontend - Candidato selezionato per ${categoria}:`, candidato.nome, candidato.cognome);
        } else {
          console.log(`❌ DEBUG - Nessun candidato trovato per ID: ${candidatoId} e categoria: ${categoria}`);
        }
      }
    }
    
    console.log('🔍 DEBUG Frontend - Candidati selezionati finali:', candidatiSelezionati);
    console.log('🔍 DEBUG Frontend - ID Map finale:', idMap);
    
    res.json({
      success: true,
      data: {
        candidati: candidatiSelezionati,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare selezioni candidati utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni candidati utente'
    });
  }
});

module.exports = router;
