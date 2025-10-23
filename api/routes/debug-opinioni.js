const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Endpoint per debug delle opinioni comuni
router.get('/debug-opinioni-comuni', async (req, res) => {
  try {
    console.log('🔍 DEBUG - Inizio debug opinioni comuni...');
    
    // 1. Trova Nicolas Micheletti
    const userResult = await pool.query(`
      SELECT id, nome, cognome FROM users 
      WHERE nome ILIKE '%nicolas%' OR cognome ILIKE '%micheletti%' OR email ILIKE '%nicolas%'
      ORDER BY nome, cognome
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      return res.json({ error: 'Nicolas Micheletti non trovato' });
    }
    
    const userId = userResult.rows[0].id;
    console.log('🔍 DEBUG - Utente trovato:', userResult.rows[0]);
    
    // 2. Ottieni le opinioni dell'utente
    const userOpinionsResult = await pool.query(`
      SELECT * FROM opinioni_risposte WHERE user_id = $1
    `, [userId]);
    
    if (userOpinionsResult.rows.length === 0) {
      return res.json({ error: 'Nessuna opinione trovata per l\'utente' });
    }
    
    const userOpinions = userOpinionsResult.rows[0];
    console.log('🔍 DEBUG - Opinion utente:', Object.keys(userOpinions).length, 'campi');
    
    // 3. Trova un candidato
    const candidatoResult = await pool.query(`
      SELECT id, nome, cognome FROM users 
      WHERE grado_elezione = 'E' AND id != $1
      LIMIT 1
    `, [userId]);
    
    if (candidatoResult.rows.length === 0) {
      return res.json({ error: 'Nessun candidato trovato' });
    }
    
    const candidatoId = candidatoResult.rows[0].id;
    console.log('🔍 DEBUG - Candidato trovato:', candidatoResult.rows[0]);
    
    // 4. Ottieni le opinioni del candidato
    const candidatoOpinionsResult = await pool.query(`
      SELECT * FROM opinioni_risposte WHERE user_id = $1
    `, [candidatoId]);
    
    if (candidatoOpinionsResult.rows.length === 0) {
      return res.json({ error: 'Nessuna opinione trovata per il candidato' });
    }
    
    const candidatoOpinions = candidatoOpinionsResult.rows[0];
    console.log('🔍 DEBUG - Opinion candidato:', Object.keys(candidatoOpinions).length, 'campi');
    
    // 5. Calcola opinioni comuni
    let opinioniComuni = 0;
    const allOpinionIds = new Set([...Object.keys(userOpinions), ...Object.keys(candidatoOpinions)]);
    
    const opinioniComuniDetails = [];
    
    allOpinionIds.forEach(opinionId => {
      if (opinionId === 'user_id' || opinionId === 'fonti_opinioni') return;
      
      const userValue = userOpinions[opinionId];
      const candidatoValue = candidatoOpinions[opinionId];
      
      if (userValue && candidatoValue && 
          userValue !== null && candidatoValue !== null &&
          (userValue === 'f' || userValue === 'c' || userValue === 'i') &&
          (candidatoValue === 'f' || candidatoValue === 'c' || candidatoValue === 'i') &&
          userValue === candidatoValue) {
        opinioniComuni++;
        opinioniComuniDetails.push({
          opinionId,
          userValue,
          candidatoValue
        });
      }
    });
    
    console.log('🔍 DEBUG - Opinion comuni calcolate:', opinioniComuni);
    
    res.json({
      success: true,
      user: userResult.rows[0],
      candidato: candidatoResult.rows[0],
      userOpinionsCount: Object.keys(userOpinions).length,
      candidatoOpinionsCount: Object.keys(candidatoOpinions).length,
      opinioniComuni,
      opinioniComuniDetails,
      userOpinionsSample: Object.keys(userOpinions).slice(0, 5).reduce((acc, key) => {
        if (key !== 'user_id' && key !== 'fonti_opinioni') {
          acc[key] = userOpinions[key];
        }
        return acc;
      }, {}),
      candidatoOpinionsSample: Object.keys(candidatoOpinions).slice(0, 5).reduce((acc, key) => {
        if (key !== 'user_id' && key !== 'fonti_opinioni') {
          acc[key] = candidatoOpinions[key];
        }
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error('❌ Errore debug opinioni comuni:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
