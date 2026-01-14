/**
 * Script per eseguire l'insert dei senatori da parlamento_voti_nominali
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function eseguiInsertSenatori() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 INSERIMENTO SENATORI DA VOTI NOMINALI');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Leggi lo script SQL
    const sqlFile = path.join(__dirname, 'insert-senatori-da-voti-nominali.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Dividi lo script in comandi separati (per le SELECT finali)
    const comandi = sql.split(';').filter(cmd => cmd.trim().length > 0);
    
    // Esegui l'INSERT (primo comando)
    console.log('🔄 Esecuzione INSERT senatori...\n');
    const insertResult = await pool.query(comandi[0] + ';');
    console.log(`✅ INSERT completato. Righe inserite: ${insertResult.rowCount || 'N/A'}\n`);
    
    // Esegui le SELECT per le statistiche
    for (let i = 1; i < comandi.length; i++) {
      const cmd = comandi[i].trim();
      if (cmd.length > 0) {
        const result = await pool.query(cmd + ';');
        if (result.rows.length > 0) {
          console.log(`📊 ${result.rows[0].report || 'Risultato'}:`);
          if (result.rows.length === 1 && result.rows[0].totale !== undefined) {
            console.log(`   Totale: ${result.rows[0].totale}`);
          } else {
            result.rows.forEach((row, idx) => {
              if (idx < 10) { // Mostra solo i primi 10
                console.log(`   ${idx + 1}. ${row.nome || ''} ${row.cognome || ''} (${row.ruolo || ''}, ${row.grado_elezione || ''})`);
              }
            });
            if (result.rows.length > 10) {
              console.log(`   ... e altri ${result.rows.length - 10} senatori`);
            }
          }
          console.log('');
        }
      }
    }
    
    console.log('='.repeat(80));
    console.log('✅ INSERIMENTO COMPLETATO');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Errore durante l\'esecuzione:', error.message);
    if (error.code === '23505') {
      console.log('ℹ️  Alcuni senatori potrebbero essere già presenti (duplicati ignorati)');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

eseguiInsertSenatori().catch(console.error);
