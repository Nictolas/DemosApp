require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDuplicati() {
  try {
    // Verifica duplicati per Giuseppe Conte
    const result = await pool.query(`
      SELECT 
        id, 
        politico, 
        titolo, 
        votazione_hash, 
        data_creazione 
      FROM notifiche_voti_parlamento 
      WHERE politico = 'Giuseppe Conte' 
      ORDER BY data_creazione DESC
    `);
    
    console.log('Notifiche per Giuseppe Conte:');
    result.rows.forEach((x, i) => {
      console.log(`  ${i + 1}. ID: ${x.id.substring(0, 8)}... | Hash: ${x.votazione_hash} | Data: ${x.data_creazione}`);
    });
    
    // Statistiche
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total, 
        COUNT(DISTINCT votazione_hash) as unique_hashes 
      FROM notifiche_voti_parlamento 
      WHERE politico = 'Giuseppe Conte'
    `);
    
    console.log('\nStatistiche:');
    console.log(`  Totale notifiche: ${stats.rows[0].total}`);
    console.log(`  Hash unici: ${stats.rows[0].unique_hashes}`);
    
    // Mostra dettagli completi delle notifiche
    const dettagli = await pool.query(`
      SELECT 
        id, 
        politico, 
        titolo, 
        voto, 
        votazione_hash, 
        data_creazione 
      FROM notifiche_voti_parlamento 
      WHERE politico = 'Giuseppe Conte' 
      ORDER BY data_creazione DESC
    `);
    
    console.log('\nDettagli completi:');
    dettagli.rows.forEach((x, i) => {
      console.log(`\n${i + 1}. ID: ${x.id.substring(0, 8)}...`);
      console.log(`   Titolo: ${x.titolo}`);
      console.log(`   Voto: ${x.voto}`);
      console.log(`   Hash: ${x.votazione_hash}`);
      console.log(`   Data: ${x.data_creazione}`);
    });
    
    // Trova duplicati (stesso hash)
    const duplicati = await pool.query(`
      SELECT 
        votazione_hash,
        COUNT(*) as count
      FROM notifiche_voti_parlamento
      WHERE politico = 'Giuseppe Conte'
      GROUP BY votazione_hash
      HAVING COUNT(*) > 1
    `);
    
    if (duplicati.rows.length > 0) {
      console.log('\n⚠️ Duplicati trovati:');
      for (const dup of duplicati.rows) {
        const dettagli = await pool.query(`
          SELECT id, data_creazione 
          FROM notifiche_voti_parlamento 
          WHERE votazione_hash = $1 
          ORDER BY data_creazione DESC
        `, [dup.votazione_hash]);
        
        console.log(`  Hash: ${dup.votazione_hash} (${dup.count} occorrenze)`);
        dettagli.rows.forEach((d, i) => {
          console.log(`    ${i + 1}. ID: ${d.id.substring(0, 8)}... | Data: ${d.data_creazione}`);
        });
        
        // Rimuovi i duplicati, mantieni solo il più recente
        if (dettagli.rows.length > 1) {
          const idsToDelete = dettagli.rows.slice(1).map(r => r.id);
          console.log(`    🗑️  Rimuovendo ${idsToDelete.length} duplicati...`);
          
          for (const id of idsToDelete) {
            await pool.query('DELETE FROM notifiche_voti_parlamento WHERE id = $1', [id]);
            console.log(`    ✅ Rimosso: ${id.substring(0, 8)}...`);
          }
        }
      }
    } else {
      console.log('\n✅ Nessun duplicato trovato');
    }
    
  } catch (error) {
    console.error('ERR:', error.message);
  } finally {
    await pool.end();
  }
}

checkDuplicati();

