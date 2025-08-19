const { Pool } = require('pg');
require('dotenv').config();

// Configurazione Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixEmailIdentifiers() {
  try {
    console.log('🔧 Inizio correzione identificatori email...');
    
    // 1. Trova tutti i campi che contengono email invece di ID
    const fieldsToCheck = [
      'rappresentante_europeo', 'rappresentante_camera', 'rappresentante_senato', 
      'rappresentante_regionale', 'rappresentante_comune',
      'candidato_europeo', 'candidato_camera', 'candidato_senato', 
      'candidato_regionale', 'candidato_comune'
    ];
    
    let totalFixed = 0;
    
    for (const field of fieldsToCheck) {
      console.log(`\n🔍 Controllo campo: ${field}`);
      
      // Trova tutti i valori che sembrano email (contengono @)
      const emailValues = await pool.query(`
        SELECT DISTINCT ${field} as value, COUNT(*) as count
        FROM users 
        WHERE ${field} LIKE '%@%' AND ${field} IS NOT NULL
        GROUP BY ${field}
      `);
      
      if (emailValues.rows.length === 0) {
        console.log(`  ✅ Campo ${field}: nessuna email trovata`);
        continue;
      }
      
      console.log(`  📧 Trovate ${emailValues.rows.length} email diverse in ${field}:`);
      
      for (const row of emailValues.rows) {
        const email = row.value;
        const count = row.count;
        
        console.log(`    📧 ${email} (${count} utenti)`);
        
        // Converti l'email con underscore in email normale
        const normalEmail = email
          .replace(/_/g, '.')  // Sostituisci underscore con punti
          .replace(/\.com/g, '.com')  // Assicurati che .com sia corretto
          .replace(/\.it/g, '.it');   // Assicurati che .it sia corretto
        
        console.log(`      🔄 Convertita in: ${normalEmail}`);
        
        // Trova l'utente con questa email normalizzata
        const userResult = await pool.query(`
          SELECT id, firestore_uid, email, nome, cognome
          FROM users 
          WHERE email = $1
        `, [normalEmail]);
        
        if (userResult.rows.length === 0) {
          console.log(`      ❌ Utente non trovato per email: ${normalEmail}`);
          continue;
        }
        
        const user = userResult.rows[0];
        const correctId = user.firestore_uid || user.id;
        
        console.log(`      ✅ Utente trovato: ${user.nome} ${user.cognome} (ID: ${correctId})`);
        
        // Aggiorna tutti gli utenti che hanno questa email nel campo
        const updateResult = await pool.query(`
          UPDATE users 
          SET ${field} = $1, updated_at = NOW()
          WHERE ${field} = $2
        `, [correctId, email]);
        
        console.log(`      🔄 Aggiornati ${updateResult.rowCount} utenti`);
        totalFixed += updateResult.rowCount;
      }
    }
    
    console.log(`\n🎉 Correzione completata!`);
    console.log(`✅ Totale aggiornamenti: ${totalFixed}`);
    
  } catch (error) {
    console.error('❌ Errore nella correzione:', error);
  } finally {
    await pool.end();
  }
}

// Esegui la correzione
fixEmailIdentifiers();
