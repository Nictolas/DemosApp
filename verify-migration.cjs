require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function verifyMigration() {
  try {
    console.log('🔍 DEBUG: VERIFICA MIGRAZIONE COMPLETATA');
    
    // 1. Controlla utenti con opinioni
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    console.log(`📊 Utenti con opinioni: ${usersWithOpinions.rows[0].count}`);
    
    // 2. Controlla utenti con dati geografici
    const usersWithGeographic = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE regione IS NOT NULL 
         OR provincia IS NOT NULL 
         OR comune IS NOT NULL
    `);
    
    console.log(`📊 Utenti con dati geografici: ${usersWithGeographic.rows[0].count}`);
    
    // 3. Controlla alcuni utenti specifici
    const sampleUsers = await pool.query(`
      SELECT id, name, email, nome, cognome, 
             energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
             regione, provincia, comune
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
      LIMIT 5
    `);
    
    console.log('\n📊 CAMPIONE UTENTI MIGRATI:');
    sampleUsers.rows.forEach(user => {
      console.log(`\n👤 ${user.nome} ${user.cognome} (${user.email})`);
      console.log(`   📍 Regione: ${user.regione || 'N/A'}`);
      console.log(`   📍 Provincia: ${user.provincia || 'N/A'}`);
      console.log(`   📍 Comune: ${user.comune || 'N/A'}`);
      console.log(`   💭 Energia Nucleare: ${user.energia_nucleare || 'N/A'}`);
      console.log(`   💭 Sperimentazione Animale: ${user.sperimentazione_animale || 'N/A'}`);
      console.log(`   💭 Legalizzazione Canapa: ${user.legalizzazione_canapa || 'N/A'}`);
    });
    
    // 4. Controlla distribuzione opinioni
    const opinionStats = await pool.query(`
      SELECT 
        energia_nucleare,
        COUNT(*) as count
      FROM users 
      WHERE energia_nucleare IS NOT NULL
      GROUP BY energia_nucleare
      ORDER BY count DESC
    `);
    
    console.log('\n📊 DISTRIBUZIONE OPINIONI (Energia Nucleare):');
    opinionStats.rows.forEach(stat => {
      console.log(`   ${stat.energia_nucleare}: ${stat.count} utenti`);
    });
    
    // 5. Controlla distribuzione geografica
    const geographicStats = await pool.query(`
      SELECT 
        regione,
        COUNT(*) as count
      FROM users 
      WHERE regione IS NOT NULL
      GROUP BY regione
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('\n📊 DISTRIBUZIONE GEOGRAFICA (Top 10):');
    geographicStats.rows.forEach(stat => {
      console.log(`   ${stat.regione}: ${stat.count} utenti`);
    });
    
    await pool.end();
    console.log('\n✅ VERIFICA COMPLETATA - MIGRAZIONE RIUSCITA!');
    
  } catch (error) {
    console.error('❌ Errore durante verifica:', error);
    await pool.end();
  }
}

verifyMigration();
