/**
 * Script per verificare lo stato dei senatori e delle notifiche
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function verifica() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICA SENATORI E NOTIFICHE');
  console.log('='.repeat(80) + '\n');
  
  try {
    const [senatori, voti, notifiche] = await Promise.all([
      pool.query("SELECT COUNT(*) as totale FROM users WHERE ruolo = 'P' AND grado_elezione = 'S'"),
      pool.query("SELECT COUNT(*) as totale FROM parlamento_voti_nominali WHERE camera = 'Senato'"),
      pool.query("SELECT COUNT(*) as totale FROM notifiche_voti_parlamento WHERE camera = 'Senato'")
    ]);
    
    console.log('📊 Riepilogo:');
    console.log(`   - Senatori in users: ${senatori.rows[0].totale}`);
    console.log(`   - Voti Senato salvati: ${voti.rows[0].totale}`);
    console.log(`   - Notifiche Senato create: ${notifiche.rows[0].totale}`);
    
    // Verifica alcuni esempi
    const esempiSenatori = await pool.query(`
      SELECT nome, cognome 
      FROM users 
      WHERE ruolo = 'P' AND grado_elezione = 'S' 
      ORDER BY cognome, nome 
      LIMIT 5
    `);
    
    console.log('\n📋 Esempi senatori inseriti:');
    esempiSenatori.rows.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.nome} ${s.cognome}`);
    });
    
    const esempiNotifiche = await pool.query(`
      SELECT politico, voto, COUNT(*) as utenti
      FROM notifiche_voti_parlamento 
      WHERE camera = 'Senato'
      GROUP BY politico, voto
      ORDER BY utenti DESC
      LIMIT 5
    `);
    
    if (esempiNotifiche.rows.length > 0) {
      console.log('\n📋 Esempi notifiche create:');
      esempiNotifiche.rows.forEach((n, i) => {
        console.log(`   ${i + 1}. ${n.politico}: ${n.voto} (${n.utenti} utenti notificati)`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICA COMPLETATA');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

verifica().catch(console.error);
