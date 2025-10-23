const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

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
        email,
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
            email,
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
router.get('/sostenitori', async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
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
        sostenitori: sostenitori,
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
        email,
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
        
        // Ottieni le opinioni dell'utente corrente dalla tabella opinioni_risposte
        let userOpinions = null;
        if (req.userId) {
          const userAnswersQuery = `
            SELECT * FROM opinioni_risposte WHERE user_id = $1
          `;
          
          const userAnswersResult = await pool.query(userAnswersQuery, [req.userId]);
          userOpinions = {};
          
          if (userAnswersResult.rows.length > 0) {
            const userRow = userAnswersResult.rows[0];
            // Mappa tutte le colonne di opinioni (escludendo user_id e fonti_opinioni)
            Object.keys(userRow).forEach(key => {
              if (key !== 'user_id' && key !== 'fonti_opinioni') {
                userOpinions[key] = userRow[key];
              }
            });
          }
        }
        
          // Se non c'è un utente corrente, usa Nicolas Micheletti come riferimento per il test
          if (!userOpinions) {
            // Prima trova l'ID di Nicolas Micheletti
            const testUserResult = await pool.query(`
              SELECT id FROM users 
              WHERE nome ILIKE '%nicolas%' OR cognome ILIKE '%micheletti%' OR email ILIKE '%nicolas%'
              ORDER BY nome, cognome
              LIMIT 1
            `);
            
            if (testUserResult.rows.length > 0) {
              const testUserId = testUserResult.rows[0].id;
              const testUserAnswersQuery = `
                SELECT * FROM opinioni_risposte WHERE user_id = $1
              `;
              
              const testUserAnswersResult = await pool.query(testUserAnswersQuery, [testUserId]);
              userOpinions = {};
              
              if (testUserAnswersResult.rows.length > 0) {
                const testUserRow = testUserAnswersResult.rows[0];
                // Mappa tutte le colonne di opinioni (escludendo user_id e fonti_opinioni)
                Object.keys(testUserRow).forEach(key => {
                  if (key !== 'user_id' && key !== 'fonti_opinioni') {
                    userOpinions[key] = testUserRow[key];
                  }
                });
              }
            }
          }
        
        if (!userOpinions) {
          return { ...candidato, opinioniComuni: 0 };
        }
        
        // Ottieni le opinioni del grado specifico dal database
        const gradoOpinioniQuery = `
          SELECT id FROM opinioni_domande WHERE $1 = ANY(gradi_opinione)
        `;
        const gradoOpinioniResult = await pool.query(gradoOpinioniQuery, [grado_candidatura]);
        const opinioniDelGrado = new Set(gradoOpinioniResult.rows.map(row => row.id));
        
        console.log(`🔍 DEBUG - Opinion del grado ${grado_candidatura}:`, opinioniDelGrado.size);
        console.log(`🔍 DEBUG - Opinion del grado:`, Array.from(opinioniDelGrado));
        
        // Calcola opinioni comuni confrontando SOLO le opinioni del grado specifico
        let opinioniComuni = 0;
        const allOpinionIds = new Set([...Object.keys(candidatoData), ...Object.keys(userOpinions)]);
        
        allOpinionIds.forEach(opinionId => {
          // Filtra solo le opinioni del grado specifico
          if (!opinioniDelGrado.has(opinionId)) {
            console.log(`⏭️ SALTATA - ${opinionId} (non del grado ${grado_candidatura})`);
            return;
          }
          
          const candidatoValue = candidatoData[opinionId];
          const userValue = userOpinions[opinionId];
          
          // Conta come opinione comune SOLO se:
          // 1. Entrambi hanno risposto (non null)
          // 2. Entrambi hanno un valore valido (f, c, i)
          // 3. I valori sono identici
          if (candidatoValue && userValue && 
              candidatoValue !== null && userValue !== null &&
              (candidatoValue === 'f' || candidatoValue === 'c' || candidatoValue === 'i') &&
              (userValue === 'f' || userValue === 'c' || userValue === 'i') &&
              candidatoValue === userValue) {
            opinioniComuni++;
            console.log(`✅ OPINIONE COMUNE (${grado_candidatura}): ${opinionId} = "${candidatoValue}"`);
          }
        });
        
           console.log(`🔍 DEBUG API - Candidato ${candidato.nome} ${candidato.cognome} (ID: ${candidato.id}):`);
           console.log('  Opinioni Candidato:', candidatoData);
           console.log('  Opinioni Utente:', userOpinions);
           console.log('  Opinioni Comuni Calcolate:', opinioniComuni);
           return { ...candidato, opinioniComuni };
      } catch (error) {
        console.error('❌ Errore nel calcolo opinioni comuni per candidato:', candidato.id, error);
        return { ...candidato, opinioniComuni: 0 };
      }
    }));
    
    // Ordina per opinioni comuni (decrescente) e prendi i primi 4
    const candidatiOrdinati = candidatiConOpinioni
      .sort((a, b) => (b.opinioniComuni || 0) - (a.opinioniComuni || 0))
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
            email,
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
