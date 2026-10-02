require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

async function testNicolasOpinioni() {
  try {
    console.log('🔍 Test opinioni Nicolas Micheletti...');
    
    // Trova Nicolas Micheletti
    const userResult = await pool.query(`
      SELECT u.id, u.nome, u.cognome, u.email
      FROM users u 
      WHERE u.nome ILIKE '%nicolas%' OR u.cognome ILIKE '%micheletti%' OR u.email ILIKE '%nicolas%'
      ORDER BY u.nome, u.cognome
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Nicolas Micheletti non trovato');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Nicolas Micheletti trovato:', user);
    
    // Conta le sue opinioni
    const opinioniResult = await pool.query(`
      SELECT COUNT(*) as total_opinioni
      FROM opinioni_risposte 
      WHERE user_id = $1
    `, [user.id]);
    
    console.log('📊 Opinion totali:', opinioniResult.rows[0].total_opinioni);
    
    // Mostra alcune opinioni di esempio
    const opinioniSample = await pool.query(`
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia
      FROM opinioni_risposte 
      WHERE user_id = $1
    `, [user.id]);
    
    if (opinioniSample.rows.length > 0) {
      console.log('📋 Sample opinioni:', opinioniSample.rows[0]);
    } else {
      console.log('❌ Nessuna opinione trovata per Nicolas Micheletti');
    }
    
    // Trova candidati europei
    const candidatiResult = await pool.query(`
      SELECT u.id, u.nome, u.cognome, COUNT(orr.*) as opinioni_count
      FROM users u 
      LEFT JOIN opinioni_risposte orr ON u.id = orr.user_id
      WHERE u.grado_elezione = 'E' AND u.id != $1
      GROUP BY u.id, u.nome, u.cognome
      LIMIT 3
    `, [user.id]);
    
    console.log('👥 Candidati europei trovati:', candidatiResult.rows.length);
    candidatiResult.rows.forEach(candidato => {
      console.log(`  - ${candidato.nome} ${candidato.cognome}: ${candidato.opinioni_count} opinioni`);
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

testNicolasOpinioni();
