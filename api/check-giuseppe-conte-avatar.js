require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function checkGiuseppeConte() {
  try {
    // Trova Giuseppe Conte in users
    const userResult = await pool.query(`
      SELECT id, nome, cognome, avatar_config 
      FROM users 
      WHERE CONCAT(nome, ' ', cognome) = 'Giuseppe Conte' 
        AND ruolo = 'P'
    `);
    
    console.log('Giuseppe Conte in users:');
    if (userResult.rows.length > 0) {
      const u = userResult.rows[0];
      console.log(`  ID: ${u.id}`);
      console.log(`  Nome: ${u.nome} ${u.cognome}`);
      console.log(`  Avatar config: ${u.avatar_config ? 'Presente' : 'Mancante'}`);
      if (u.avatar_config) {
        console.log(`  Avatar config (primi 50 char): ${u.avatar_config.substring(0, 50)}...`);
      }
    } else {
      console.log('  NON TROVATO');
    }
    
    // Trova la notifica
    const notificaResult = await pool.query(`
      SELECT id_utente, politico 
      FROM notifiche_voti_parlamento 
      WHERE politico = 'Giuseppe Conte'
    `);
    
    console.log('\nNotifica in notifiche_voti_parlamento:');
    if (notificaResult.rows.length > 0) {
      const n = notificaResult.rows[0];
      console.log(`  id_utente: ${n.id_utente}`);
      console.log(`  politico: ${n.politico}`);
      
      if (userResult.rows.length > 0) {
        const match = n.id_utente === userResult.rows[0].id;
        console.log(`\nMatch ID: ${match ? '✅ SI' : '❌ NO'}`);
        
        if (!match) {
          console.log('\n⚠️ PROBLEMA: id_utente nella notifica non corrisponde all\'ID di Giuseppe Conte in users!');
          console.log(`  ID notifica: ${n.id_utente}`);
          console.log(`  ID users: ${userResult.rows[0].id}`);
        }
      }
    } else {
      console.log('  Nessuna notifica trovata');
    }
    
    // Verifica cosa restituisce la query dell'API
    if (userResult.rows.length > 0 && notificaResult.rows.length > 0) {
      const apiQueryResult = await pool.query(`
        SELECT 
          nvp.id,
          nvp.id_utente,
          nvp.titolo,
          nvp.testo,
          COALESCE(nvp.data, CURRENT_DATE) as data,
          COALESCE(nvp.data_creazione, CURRENT_TIMESTAMP) as data_creazione,
          nvp.voto,
          nvp.camera,
          nvp.politico,
          COALESCE(nvp.likes, 0) as likes,
          COALESCE(nvp.dislikes, 0) as dislikes,
          'notifiche_voti_parlamento' as tabella_origine,
          u.nome as politico_nome,
          u.cognome as politico_cognome,
          u.avatar_config as politico_avatar_config
        FROM notifiche_voti_parlamento nvp
        LEFT JOIN users u ON nvp.id_utente = u.id
        WHERE nvp.politico = 'Giuseppe Conte'
        LIMIT 1
      `);
      
      console.log('\nRisultato query API:');
      if (apiQueryResult.rows.length > 0) {
        const r = apiQueryResult.rows[0];
        console.log(`  politico_nome: ${r.politico_nome}`);
        console.log(`  politico_cognome: ${r.politico_cognome}`);
        console.log(`  politico_avatar_config: ${r.politico_avatar_config ? 'Presente' : 'NULL/Mancante'}`);
        if (r.politico_avatar_config) {
          console.log(`  Avatar config (primi 50 char): ${r.politico_avatar_config.substring(0, 50)}...`);
        }
      }
    }
    
  } catch (error) {
    console.error('ERR:', error.message);
  } finally {
    await pool.end();
  }
}

checkGiuseppeConte();


