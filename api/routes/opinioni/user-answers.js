const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/profile - Ottieni solo le domande delle opinioni (per EditOpinioniDialog)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/profile - Richiesta domande opinioni');
    
    // Query per ottenere le domande delle opinioni dalla tabella opinioni_domande
    const opinionQuery = `
      SELECT DISTINCT 
        CASE 
          WHEN o.gradi_opinione IS NOT NULL AND array_length(o.gradi_opinione, 1) > 0 
          THEN o.gradi_opinione[1] 
          ELSE 'Nazionale' 
        END as grado_primario, 
        o.text
      FROM opinioni_domande o
      WHERE o.text IS NOT NULL AND o.text != ''
      ORDER BY grado_primario, o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery);
    
    console.log(`🔍 DEBUG - Risultati query: ${opinionResult.rows.length} righe`);
    
    if (opinionResult.rows.length === 0) {
      console.log('⚠️ Nessuna opinione trovata nella tabella opinioni_domande');
      return res.json({
        success: true,
        data: {
          questions: []
        },
        message: 'Nessuna opinione disponibile'
      });
    }
    
    // Formatta le domande per il frontend - SENZA prefisso del grado
    const questions = opinionResult.rows.map(row => ({
      id: row.text.replace(/\s+/g, '_'),
      text: row.text
    }));
    
    console.log(`✅ Trovate ${questions.length} domande opinioni`);

    res.json({
      success: true,
      data: {
        questions: questions
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare domande opinioni:', error);
    
    // Se la tabella non esiste, restituisci un array vuoto invece di un errore
    if (error.code === '42P01') { // Tabella non esiste
      console.log('⚠️ Tabella opinioni_domande non esiste, restituisco array vuoto');
      return res.json({
        success: true,
        data: {
          questions: []
        },
        message: 'Tabella opinioni_domande non disponibile'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare domande opinioni'
    });
  }
});

// POST /api/opinioni/salva - Salva le opinioni dell'utente
router.post('/salva', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { opinioni } = req.body;
    
    console.log('💾 POST /api/opinioni/salva - Salvataggio opinioni utente');
    console.log('👤 User ID:', userId);
    console.log('📋 Opinion ricevute:', opinioni);
    console.log('🔍 Tipo opinioni:', typeof opinioni);
    console.log('🔍 Chiavi opinioni:', Object.keys(opinioni || {}));
    
    if (!opinioni || typeof opinioni !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti',
        message: 'Il campo opinioni è obbligatorio'
      });
    }
    
    // Funzione per ottenere l'ID dell'opinione dal testo
    const getOpinioneIdByText = async (opinionText) => {
      const result = await pool.query(`
        SELECT id FROM opinioni_domande 
        WHERE text ILIKE $1
      `, [`%${opinionText.replace(/_/g, ' ')}%`]);
      return result.rows[0]?.id;
    };
    
    // Salva le opinioni nella nuova struttura
    let savedCount = 0;
    let errorCount = 0;
    
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      console.log(`🔍 DEBUG - Processando opinione: ${opinionId} = ${risposta}`);
      
      try {
        // Ottieni l'ID dell'opinione dalla tabella opinioni_domande
        const opinioneId = await getOpinioneIdByText(opinionId);
        
        if (!opinioneId) {
          console.warn(`⚠️ Opinione non trovata: ${opinionId}`);
          errorCount++;
          continue;
        }
        
        // Gestisci i valori compressi dal frontend
        let dbValue = null;
        if (risposta === 'f') dbValue = 'f';
        else if (risposta === 'c') dbValue = 'c';
        else if (risposta === 'i') dbValue = 'i';
        else if (risposta === 'Favorevole') dbValue = 'f';
        else if (risposta === 'Contrario') dbValue = 'c';
        else if (risposta === 'Indeciso') dbValue = 'i';
        else if (risposta === 'Astenuto') dbValue = null;
        
        // Inserisci o aggiorna nella tabella opinioni_risposte
        await pool.query(`
          INSERT INTO opinioni_risposte (user_id, opinione_id, risposta)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, opinione_id) DO UPDATE SET
            risposta = EXCLUDED.risposta
        `, [userId, opinioneId, dbValue]);
        
        savedCount++;
        console.log(`✅ Salvata opinione ${opinionId} (ID: ${opinioneId}) = ${dbValue}`);
        
      } catch (error) {
        console.error(`❌ Errore nel salvare opinione ${opinionId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`📊 Risultato salvataggio: ${savedCount} salvate, ${errorCount} errori`);
    
    if (savedCount === 0) {
      console.error('❌ ERRORE: Nessuna opinione salvata');
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    console.log('✅ Opinion salvate con successo per utente:', userId);
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      savedCount: savedCount,
      errorCount: errorCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni'
    });
  }
});

// GET /api/opinioni/:id/approfondimento - Ottieni approfondimento di un'opinione
router.get('/:id/approfondimento', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 GET /api/opinioni/:id/approfondimento - Richiesta approfondimento per opinione:', id);
    
    // Cerca per ID se è numerico, altrimenti cerca per text
    let query, params;
    if (/^\d+$/.test(id)) {
      // ID numerico
      query = `
        SELECT id, text, approfondimento, gradi_opinione
        FROM opinioni_domande 
        WHERE id = $1
      `;
      params = [id];
    } else {
      // ID testuale (es. energia_nucleare)
      const textToSearch = id.replace(/_/g, ' ');
      console.log('🔍 DEBUG - Cercando opinione con testo:', textToSearch);
      
      query = `
        SELECT id, text, approfondimento, gradi_opinione
        FROM opinioni_domande 
        WHERE LOWER(TRIM(text)) = LOWER(TRIM($1))
      `;
      params = [textToSearch];
    }
    
    let result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Opinione non trovata con testo, provo con ID diretto:', id);
      // Fallback: prova a cercare per ID diretto
      const fallbackQuery = `
        SELECT id, text, approfondimento, gradi_opinione
        FROM opinioni_domande 
        WHERE id = $1
      `;
      result = await pool.query(fallbackQuery, [id]);
      
      if (result.rows.length === 0) {
        console.log('⚠️ Opinione non trovata nemmeno per ID:', id);
        return res.status(404).json({
          success: false,
          error: 'Opinione non trovata'
        });
      }
    }
    
    const opinione = result.rows[0];
    
    console.log('✅ Opinione trovata:', {
      id: opinione.id,
      text: opinione.text,
      hasApprofondimento: !!opinione.approfondimento,
      gradi_opinione: opinione.gradi_opinione
    });
    
    res.json({
      success: true,
      data: {
        id: opinione.id,
        text: opinione.text,
        approfondimento: opinione.approfondimento || '',
        gradi_opinione: opinione.gradi_opinione || []
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare approfondimento:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Se la tabella non esiste, restituisci dati di default
    if (error.code === '42P01') { // Tabella non esiste
      console.log('⚠️ Tabella opinioni_domande non esiste, restituisco dati di default');
      return res.json({
        success: true,
        data: {
          id: req.params.id,
          text: 'Opinione non trovata',
          approfondimento: '',
          gradi_opinione: []
        }
      });
    }
    
    // Se la colonna non esiste, restituisci dati di default
    if (error.code === '42703') { // Colonna non esiste
      console.log('⚠️ Colonna non esiste nella tabella opinioni_domande, restituisco dati di default');
      return res.json({
        success: true,
        data: {
          id: req.params.id,
          text: 'Opinione non trovata',
          approfondimento: '',
          gradi_opinione: []
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare approfondimento',
      details: error.message
    });
  }
});

// PUT /api/opinioni/:id/approfondimento - Aggiorna approfondimento di un'opinione (solo admin)
router.put('/:id/approfondimento', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { approfondimento, gradi_opinione } = req.body;
    
    console.log('💾 PUT /api/opinioni/:id/approfondimento - Salvataggio approfondimento per opinione:', id);
    console.log('📋 Dati ricevuti:', { approfondimento, gradi_opinione });
    
    // Verifica che l'utente sia admin
    const userQuery = `
      SELECT ruolo FROM users WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [req.userId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono modificare gli approfondimenti'
      });
    }
    
    // Cerca per ID se è numerico, altrimenti cerca per text
    let updateQuery, params;
    if (/^\d+$/.test(id)) {
      // ID numerico
      updateQuery = `
        UPDATE opinioni_domande 
        SET approfondimento = $1, gradi_opinione = $2
        WHERE id = $3
        RETURNING id, text, approfondimento, gradi_opinione
      `;
      params = [approfondimento || '', gradi_opinione || [], id];
    } else {
      // ID testuale (es. energia_nucleare)
      const textToSearch = id.replace(/_/g, ' ');
      console.log('🔍 DEBUG - Aggiornando opinione con testo:', textToSearch);
      
      updateQuery = `
        UPDATE opinioni_domande 
        SET approfondimento = $1, gradi_opinione = $2
        WHERE LOWER(TRIM(text)) = LOWER(TRIM($3))
        RETURNING id, text, approfondimento, gradi_opinione
      `;
      params = [approfondimento || '', gradi_opinione || [], textToSearch];
    }
    
    let result = await pool.query(updateQuery, params);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Opinione non trovata con testo per update, provo con ID diretto:', id);
      // Fallback: prova a cercare per ID diretto
      const fallbackUpdateQuery = `
        UPDATE opinioni_domande 
        SET approfondimento = $1, gradi_opinione = $2
        WHERE id = $3
        RETURNING id, text, approfondimento, gradi_opinione
      `;
      result = await pool.query(fallbackUpdateQuery, [approfondimento || '', gradi_opinione || [], id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Opinione non trovata'
        });
      }
    }
    
    console.log('✅ Approfondimento salvato con successo per opinione:', id);
    
    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        text: result.rows[0].text,
        approfondimento: result.rows[0].approfondimento,
        gradi_opinione: result.rows[0].gradi_opinione
      },
      message: 'Approfondimento salvato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare approfondimento:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Se la colonna non esiste, restituisci un errore specifico
    if (error.code === '42703') { // Colonna non esiste
      console.log('⚠️ Colonna non esiste nella tabella opinioni_domande');
      return res.status(500).json({
        success: false,
        error: 'Colonna mancante',
        message: 'Le colonne approfondimento e gradi_opinione devono essere aggiunte alla tabella opinioni_domande'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare approfondimento',
      details: error.message
    });
  }
});

module.exports = router;
