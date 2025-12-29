require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function completeElectionData() {
  try {
    console.log('🔧 DEBUG: COMPLETAMENTO DATI ELEZIONE');
    
    // 1. AGGIORNA I DATI GEOGRAFICI DI ELEZIONE PER GLI UTENTI CON GRADO ELEZIONE
    console.log('🔄 Aggiornamento dati geografici di elezione...');
    
    const updateResult = await pool.query(`
      UPDATE users 
      SET 
        regione = regione_residenza,
        provincia = provincia_residenza,
        comune = comune_residenza,
        updated_at = NOW()
      WHERE grado_elezione IS NOT NULL 
        AND regione_residenza IS NOT NULL
        AND (regione IS NULL OR provincia IS NULL OR comune IS NULL)
    `);
    
    console.log(`✅ Aggiornati ${updateResult.rowCount} utenti con dati geografici di elezione`);
    
    // 2. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN grado_elezione IS NOT NULL THEN 1 END) as with_grado_elezione,
        COUNT(CASE WHEN grado_elezione IS NOT NULL AND regione IS NOT NULL THEN 1 END) as with_grado_and_regione,
        COUNT(CASE WHEN grado_elezione IS NOT NULL AND provincia IS NOT NULL THEN 1 END) as with_grado_and_provincia,
        COUNT(CASE WHEN grado_elezione IS NOT NULL AND comune IS NOT NULL THEN 1 END) as with_grado_and_comune
      FROM users
    `);
    
    const stats = finalStats.rows[0];
    console.log(`📊 Totale utenti: ${stats.total}`);
    console.log(`📊 Con grado_elezione: ${stats.with_grado_elezione}`);
    console.log(`📊 Con grado_elezione + regione: ${stats.with_grado_and_regione}`);
    console.log(`📊 Con grado_elezione + provincia: ${stats.with_grado_and_provincia}`);
    console.log(`📊 Con grado_elezione + comune: ${stats.with_grado_and_comune}`);
    
    // 3. MOSTRA ALCUNI ESEMPI AGGIORNATI
    console.log('\n📊 ESEMPI UTENTI AGGIORNATI:');
    const sampleUsers = await pool.query(`
      SELECT id, name, email, nome, cognome, 
             grado_elezione, paese_elezione,
             regione, provincia, comune,
             regione_residenza, provincia_residenza, comune_residenza
      FROM users 
      WHERE grado_elezione IS NOT NULL 
        AND regione IS NOT NULL
      LIMIT 5
    `);
    
    sampleUsers.rows.forEach(user => {
      console.log(`\n👤 ${user.nome} ${user.cognome} (${user.email}):`);
      console.log(`   🏛️ Grado Elezione: ${user.grado_elezione}`);
      console.log(`   🏛️ Paese Elezione: ${user.paese_elezione}`);
      console.log(`   📍 Regione Elezione: ${user.regione}`);
      console.log(`   📍 Provincia Elezione: ${user.provincia}`);
      console.log(`   📍 Comune Elezione: ${user.comune}`);
      console.log(`   🏠 Regione Residenza: ${user.regione_residenza}`);
      console.log(`   🏠 Provincia Residenza: ${user.provincia_residenza}`);
      console.log(`   🏠 Comune Residenza: ${user.comune_residenza}`);
    });
    
    // 4. DISTRIBUZIONE GRADI ELEZIONE
    console.log('\n📊 DISTRIBUZIONE GRADI ELEZIONE:');
    const electionStats = await pool.query(`
      SELECT 
        grado_elezione,
        COUNT(*) as count
      FROM users 
      WHERE grado_elezione IS NOT NULL
      GROUP BY grado_elezione
      ORDER BY count DESC
    `);
    
    electionStats.rows.forEach(stat => {
      console.log(`   ${stat.grado_elezione}: ${stat.count} utenti`);
    });
    
    await pool.end();
    console.log('\n✅ COMPLETAMENTO DATI ELEZIONE TERMINATO!');
    
  } catch (error) {
    console.error('❌ Errore durante completamento:', error);
    await pool.end();
  }
}

completeElectionData();
