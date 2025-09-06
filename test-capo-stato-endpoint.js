const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testCapoStatoEndpoint() {
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database');
    
    // Simula la query dell'endpoint
    const query = `
      SELECT 
        nome,
        COUNT(*) as voti_totali,
        COUNT(DISTINCT userid) as votanti_unici,
        MAX(timestamp) as ultimo_voto
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti_totali DESC, ultimo_voto DESC
    `;
    
    const result = await client.query(query);
    
    console.log('🔍 DEBUG - Candidati trovati:', result.rows.length);
    result.rows.forEach((candidato, index) => {
      console.log(`${index + 1}. ${candidato.nome} - Voti: ${candidato.voti_totali} (Votanti unici: ${candidato.votanti_unici})`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
  }
}

testCapoStatoEndpoint();
