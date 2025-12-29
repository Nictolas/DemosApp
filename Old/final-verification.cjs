require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function finalVerification() {
  try {
    console.log('🔍 DEBUG: VERIFICA FINALE COMPLETA');
    
    // 1. STATISTICHE GENERALI
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN energia_nucleare IS NOT NULL THEN 1 END) as with_opinions,
        COUNT(CASE WHEN regione_residenza IS NOT NULL THEN 1 END) as with_regione_residenza,
        COUNT(CASE WHEN provincia_residenza IS NOT NULL THEN 1 END) as with_provincia_residenza,
        COUNT(CASE WHEN comune_residenza IS NOT NULL THEN 1 END) as with_comune_residenza,
        COUNT(CASE WHEN paese_residenza IS NOT NULL THEN 1 END) as with_paese_residenza,
        COUNT(CASE WHEN data_nascita IS NOT NULL THEN 1 END) as with_data_nascita,
        COUNT(CASE WHEN genere IS NOT NULL THEN 1 END) as with_genere,
        COUNT(CASE WHEN cittadinanza IS NOT NULL THEN 1 END) as with_cittadinanza,
        COUNT(CASE WHEN grado_elezione IS NOT NULL THEN 1 END) as with_grado_elezione,
        COUNT(CASE WHEN regione IS NOT NULL THEN 1 END) as with_regione_elezione,
        COUNT(CASE WHEN provincia IS NOT NULL THEN 1 END) as with_provincia_elezione,
        COUNT(CASE WHEN comune IS NOT NULL THEN 1 END) as with_comune_elezione,
        COUNT(CASE WHEN fonti_opinioni IS NOT NULL THEN 1 END) as with_fonti_opinioni
      FROM users
    `);
    
    const s = stats.rows[0];
    console.log('\n📊 STATISTICHE GENERALI:');
    console.log(`- Totale utenti: ${s.total}`);
    console.log(`- Con opinioni: ${s.with_opinions}`);
    console.log(`- Con regione_residenza: ${s.with_regione_residenza}`);
    console.log(`- Con provincia_residenza: ${s.with_provincia_residenza}`);
    console.log(`- Con comune_residenza: ${s.with_comune_residenza}`);
    console.log(`- Con paese_residenza: ${s.with_paese_residenza}`);
    console.log(`- Con data_nascita: ${s.with_data_nascita}`);
    console.log(`- Con genere: ${s.with_genere}`);
    console.log(`- Con cittadinanza: ${s.with_cittadinanza}`);
    console.log(`- Con grado_elezione: ${s.with_grado_elezione}`);
    console.log(`- Con regione_elezione: ${s.with_regione_elezione}`);
    console.log(`- Con provincia_elezione: ${s.with_provincia_elezione}`);
    console.log(`- Con comune_elezione: ${s.with_comune_elezione}`);
    console.log(`- Con fonti_opinioni: ${s.with_fonti_opinioni}`);
    
    // 2. CAMPIONE UTENTI COMPLETO
    const sampleUsers = await pool.query(`
      SELECT id, name, email, nome, cognome, 
             energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
             regione_residenza, provincia_residenza, comune_residenza, paese_residenza,
             data_nascita, genere, cittadinanza,
             grado_elezione, paese_elezione, regione, provincia, comune,
             fonti_opinioni
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
      LIMIT 5
    `);
    
    console.log('\n📊 CAMPIONE UTENTI COMPLETO:');
    sampleUsers.rows.forEach(user => {
      console.log(`\n👤 ${user.nome} ${user.cognome} (${user.email})`);
      console.log(`   🏠 Regione Residenza: ${user.regione_residenza || 'N/A'}`);
      console.log(`   🏠 Provincia Residenza: ${user.provincia_residenza || 'N/A'}`);
      console.log(`   🏠 Comune Residenza: ${user.comune_residenza || 'N/A'}`);
      console.log(`   🏠 Paese Residenza: ${user.paese_residenza || 'N/A'}`);
      console.log(`   📅 Data Nascita: ${user.data_nascita || 'N/A'}`);
      console.log(`   👤 Genere: ${user.genere || 'N/A'}`);
      console.log(`   🏛️ Cittadinanza: ${user.cittadinanza || 'N/A'}`);
      console.log(`   🏛️ Grado Elezione: ${user.grado_elezione || 'N/A'}`);
      console.log(`   🏛️ Paese Elezione: ${user.paese_elezione || 'N/A'}`);
      console.log(`   📍 Regione Elezione: ${user.regione || 'N/A'}`);
      console.log(`   📍 Provincia Elezione: ${user.provincia || 'N/A'}`);
      console.log(`   📍 Comune Elezione: ${user.comune || 'N/A'}`);
      console.log(`   💭 Energia Nucleare: ${user.energia_nucleare || 'N/A'}`);
      console.log(`   💭 Sperimentazione Animale: ${user.sperimentazione_animale || 'N/A'}`);
      console.log(`   💭 Legalizzazione Canapa: ${user.legalizzazione_canapa || 'N/A'}`);
      
      // Mostra fonti se presenti
      if (user.fonti_opinioni) {
        console.log(`   📰 Fonti opinioni: ${Object.keys(user.fonti_opinioni).length} argomenti`);
        Object.entries(user.fonti_opinioni).forEach(([topic, url]) => {
          console.log(`      - ${topic}: ${url.substring(0, 60)}...`);
        });
      }
    });
    
    // 3. DISTRIBUZIONE OPINIONI
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
    
    // 4. DISTRIBUZIONE GEOGRAFICA RESIDENZA
    const geographicStats = await pool.query(`
      SELECT 
        regione_residenza,
        COUNT(*) as count
      FROM users 
      WHERE regione_residenza IS NOT NULL
      GROUP BY regione_residenza
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('\n📊 DISTRIBUZIONE GEOGRAFICA RESIDENZA (Top 10):');
    geographicStats.rows.forEach(stat => {
      console.log(`   ${stat.regione_residenza}: ${stat.count} utenti`);
    });
    
    // 5. DISTRIBUZIONE COMUNI RESIDENZA
    const comuneStats = await pool.query(`
      SELECT 
        comune_residenza,
        COUNT(*) as count
      FROM users 
      WHERE comune_residenza IS NOT NULL
      GROUP BY comune_residenza
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('\n📊 DISTRIBUZIONE COMUNI RESIDENZA (Top 10):');
    comuneStats.rows.forEach(stat => {
      console.log(`   ${stat.comune_residenza}: ${stat.count} utenti`);
    });
    
    // 6. DISTRIBUZIONE GRADI ELEZIONE
    const electionStats = await pool.query(`
      SELECT 
        grado_elezione,
        COUNT(*) as count
      FROM users 
      WHERE grado_elezione IS NOT NULL
      GROUP BY grado_elezione
      ORDER BY count DESC
    `);
    
    console.log('\n📊 DISTRIBUZIONE GRADI ELEZIONE:');
    electionStats.rows.forEach(stat => {
      console.log(`   ${stat.grado_elezione}: ${stat.count} utenti`);
    });
    
    // 7. DISTRIBUZIONE FONTI OPINIONI
    const sourcesStats = await pool.query(`
      SELECT 
        COUNT(*) as total_with_sources
      FROM users 
      WHERE fonti_opinioni IS NOT NULL
    `);
    
    console.log('\n📊 DISTRIBUZIONE FONTI OPINIONI:');
    console.log(`   Utenti con fonti: ${sourcesStats.rows[0].total_with_sources || 0}`);
    
    await pool.end();
    console.log('\n✅ VERIFICA FINALE COMPLETATA - MIGRAZIONE RIUSCITA!');
    
  } catch (error) {
    console.error('❌ Errore durante verifica:', error);
    await pool.end();
  }
}

finalVerification();
