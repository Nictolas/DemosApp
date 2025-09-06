const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkCandidatiCapoStato() {
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database');
    
    // Controlla se ci sono candidati con grado_candidatura = 'Capo di Stato'
    const result = await client.query(`
      SELECT id, nome, cognome, email, ruolo, status, grado_candidatura, partito
      FROM users 
      WHERE (ruolo = 'Candidato' OR ruolo = 'Candidato Politico')
        AND status = 'active'
        AND (grado_candidatura = 'Capo di Stato' OR grado_candidatura = 'Presidente' OR grado_candidatura = 'Capo di Stato/Presidente')
      ORDER BY nome
    `);
    
    console.log('🔍 Candidati Capo di Stato trovati:', result.rows.length);
    result.rows.forEach(candidato => {
      console.log(`- ${candidato.nome} ${candidato.cognome} (${candidato.grado_candidatura}) - ${candidato.partito || 'Nessun partito'}`);
    });
    
    // Controlla anche tutti i gradi_candidatura esistenti
    const allGradi = await client.query(`
      SELECT DISTINCT grado_candidatura, COUNT(*) as count
      FROM users 
      WHERE grado_candidatura IS NOT NULL
      GROUP BY grado_candidatura
      ORDER BY grado_candidatura
    `);
    
    console.log('\n🔍 Tutti i gradi_candidatura esistenti:');
    allGradi.rows.forEach(grado => {
      console.log(`- ${grado.grado_candidatura}: ${grado.count} candidati`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
  }
}

checkCandidatiCapoStato();
