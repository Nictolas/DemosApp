const express = require('express');
const { pool, verifyToken } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/check-missing/:grado - Controlla opinioni mancanti per grado
router.get('/check-missing/:grado', verifyToken, async (req, res) => {
  try {
    const { grado } = req.params;
    const userId = req.user.id;
    
    console.log(`🔍 GET /api/opinioni/check-missing/${grado} - Controllo opinioni mancanti per utente ${userId}`);
    
    // Mappa grado frontend a database
    const gradoMapping = {
      'N': 'N',
      'E': 'E', 
      'R': 'R',
      'C': 'C',
      'CO': 'CO'  // Aggiunto per gestire grado CO
    };
    
    const gradoDatabase = gradoMapping[grado];
    if (!gradoDatabase) {
      return res.status(400).json({
        success: false,
        error: 'Grado non valido'
      });
    }
    
    // 1. Ottieni tutte le opinioni per il grado specifico
    const opinioniQuery = `
      SELECT id, text, gradi_opinione
      FROM opinioni_domande 
      WHERE $1 = ANY(gradi_opinione)
      ORDER BY id
    `;
    
    const opinioniResult = await pool.query(opinioniQuery, [gradoDatabase]);
    const opinioniDelGrado = opinioniResult.rows;
    
    console.log(`📊 Trovate ${opinioniDelGrado.length} opinioni per grado ${gradoDatabase}`);
    
    if (opinioniDelGrado.length === 0) {
      return res.json({
        success: true,
        data: {
          grado: grado,
          totaleOpinioni: 0,
          opinioniRisposte: 0,
          opinioniMancanti: 0,
          percentualeCompletamento: 100,
          isComplete: true,
          missingOpinions: []
        }
      });
    }
    
    // 2. Verifica quali colonne esistono nella tabella opinioni_risposte
    const colonneEsistentiQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name != 'user_id'
      AND column_name != 'fonti_opinioni'
    `;
    const colonneEsistentiResult = await pool.query(colonneEsistentiQuery);
    const colonneEsistenti = new Set(colonneEsistentiResult.rows.map(row => row.column_name));
    
    console.log(`📊 Colonne esistenti in opinioni_risposte: ${colonneEsistenti.size}`);
    
    // 3. Filtra le opinioni per includere solo quelle con colonna corrispondente
    // Le opinioni senza colonna sono considerate mancanti
    const opinioniConColonna = opinioniDelGrado.filter(op => colonneEsistenti.has(op.id));
    const opinioniSenzaColonna = opinioniDelGrado.filter(op => !colonneEsistenti.has(op.id));
    
    // Aggiungi le opinioni senza colonna alle mancanti
    let opinioniMancanti = opinioniSenzaColonna.map(op => ({
      id: op.id,
      text: op.text
    }));
    
    // 4. Ottieni le risposte dell'utente solo per le opinioni con colonna esistente
    let opinioniRisposte = 0;
    
    if (opinioniConColonna.length > 0) {
      const userIds = opinioniConColonna.map(op => `"${op.id}"`).join(', ');
      
      const risposteQuery = `
        SELECT ${userIds}
        FROM opinioni_risposte 
        WHERE user_id = $1
      `;
      
      try {
        const risposteResult = await pool.query(risposteQuery, [userId]);
        
        if (risposteResult.rows.length > 0) {
          const userAnswers = risposteResult.rows[0];
          
          // Conta opinioni risposte e mancanti
          opinioniConColonna.forEach(opinione => {
            const answer = userAnswers[opinione.id];
            if (answer && answer !== null && answer !== '') {
              opinioniRisposte++;
            } else {
              opinioniMancanti.push({
                id: opinione.id,
                text: opinione.text
              });
            }
          });
        } else {
          // Nessuna risposta trovata, tutte le opinioni con colonna sono mancanti
          opinioniMancanti.push(...opinioniConColonna.map(op => ({
            id: op.id,
            text: op.text
          })));
        }
      } catch (error) {
        console.error('❌ Errore nella query risposte:', error);
        // In caso di errore, considera tutte le opinioni come mancanti
        opinioniMancanti.push(...opinioniConColonna.map(op => ({
          id: op.id,
          text: op.text
        })));
      }
    } else {
      // Nessuna opinione ha colonna corrispondente, tutte sono mancanti
      console.log('⚠️ Nessuna opinione ha colonna corrispondente in opinioni_risposte');
    }
    
    const percentualeCompletamento = opinioniDelGrado.length > 0 
      ? Math.round((opinioniRisposte / opinioniDelGrado.length) * 100)
      : 100;
    
    const isComplete = opinioniMancanti.length === 0;
    
    console.log(`📊 Risultati per grado ${gradoDatabase}:`, {
      totaleOpinioni: opinioniDelGrado.length,
      opinioniRisposte,
      opinioniMancanti: opinioniMancanti.length,
      percentualeCompletamento,
      isComplete
    });
    
    res.json({
      success: true,
      data: {
        grado: grado,
        totaleOpinioni: opinioniDelGrado.length,
        opinioniRisposte,
        opinioniMancanti: opinioniMancanti.length,
        percentualeCompletamento,
        isComplete,
        missingOpinions: opinioniMancanti
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel controllo opinioni mancanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile controllare le opinioni mancanti'
    });
  }
});

module.exports = router;
