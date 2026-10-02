const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function testCapoStatoEndpoint() {
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database');
    
    // Simula la query dell'endpoint
    const query = `
      SELECT 
        nome,
        COUNT(*) as voti
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti DESC, nome ASC
    `;
    
    const result = await client.query(query);
    
    console.log('🔍 DEBUG - Candidati trovati:', result.rows.length);
    
    const classifica = result.rows.map(candidato => ({
      nome: candidato.nome,
      voti: parseInt(candidato.voti)
    }));
    
    const responseData = {
      classifica,
      mieiVoti: [],
      blocco: {
        isBlocked: false,
        unlockDate: null
      }
    };
    
    console.log('📊 Struttura dati restituita:');
    console.log(JSON.stringify(responseData, null, 2));
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
  }
}

testCapoStatoEndpoint();
