require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testCalcoloOpinioniComuni() {
  try {
    console.log('🔍 Test calcolo opinioni comuni...');
    
    // 1. Trova Nicolas Micheletti
    const userResult = await pool.query(`
      SELECT id, nome, cognome FROM users 
      WHERE nome ILIKE '%nicolas%' OR cognome ILIKE '%micheletti%' OR email ILIKE '%nicolas%'
      ORDER BY nome, cognome
      LIMIT 1
    `);
    
    const userId = userResult.rows[0].id;
    console.log('👤 Utente:', userResult.rows[0]);
    
    // 2. Ottieni le opinioni dell'utente
    const userOpinionsResult = await pool.query(`
      SELECT * FROM opinioni_risposte WHERE user_id = $1
    `, [userId]);
    
    const userOpinions = userOpinionsResult.rows[0];
    console.log('📊 Opinion utente:', Object.keys(userOpinions).length, 'campi');
    
    // 3. Trova un candidato
    const candidatoResult = await pool.query(`
      SELECT id, nome, cognome FROM users 
      WHERE grado_elezione = 'E' AND id != $1
      LIMIT 1
    `, [userId]);
    
    const candidatoId = candidatoResult.rows[0].id;
    console.log('👥 Candidato:', candidatoResult.rows[0]);
    
    // 4. Ottieni le opinioni del candidato
    const candidatoOpinionsResult = await pool.query(`
      SELECT * FROM opinioni_risposte WHERE user_id = $1
    `, [candidatoId]);
    
    const candidatoOpinions = candidatoOpinionsResult.rows[0];
    console.log('📊 Opinion candidato:', Object.keys(candidatoOpinions).length, 'campi');
    
    // 5. Calcola opinioni comuni (stessa logica dell'API)
    let opinioniComuni = 0;
    const allOpinionIds = new Set([...Object.keys(userOpinions), ...Object.keys(candidatoOpinions)]);
    
    console.log('🔍 Calcolo opinioni comuni...');
    allOpinionIds.forEach(opinionId => {
      if (opinionId === 'user_id' || opinionId === 'fonti_opinioni') return;
      
      const userValue = userOpinions[opinionId];
      const candidatoValue = candidatoOpinions[opinionId];
      
      console.log(`  ${opinionId}: utente="${userValue}" candidato="${candidatoValue}"`);
      
      if (userValue && candidatoValue && 
          userValue !== null && candidatoValue !== null &&
          (userValue === 'f' || userValue === 'c' || userValue === 'i') &&
          (candidatoValue === 'f' || candidatoValue === 'c' || candidatoValue === 'i') &&
          userValue === candidatoValue) {
        opinioniComuni++;
        console.log(`    ✅ OPINIONE COMUNE: ${opinionId} = "${userValue}"`);
      }
    });
    
    console.log(`🎯 RISULTATO: ${opinioniComuni} opinioni comuni`);
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

testCalcoloOpinioniComuni();
