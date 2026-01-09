require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verificaRuoli() {
  try {
    // Conta politici con ruolo P (attualmente eletti)
    const resultP = await pool.query(`
      SELECT COUNT(*) as totale 
      FROM users 
      WHERE ruolo = 'P' 
        AND (grado_elezione = 'C' OR grado_elezione = 'S') 
        AND status = 'a'
    `);

    // Conta politici con ruolo E (non eletti)
    const resultE = await pool.query(`
      SELECT COUNT(*) as totale 
      FROM users 
      WHERE ruolo = 'E' 
        AND (grado_elezione = 'C' OR grado_elezione = 'S') 
        AND status = 'a'
    `);

    // Mostra alcuni esempi di politici con ruolo E
    const esempiE = await pool.query(`
      SELECT nome, cognome, grado_elezione 
      FROM users 
      WHERE ruolo = 'E' 
        AND (grado_elezione = 'C' OR grado_elezione = 'S') 
        AND status = 'a' 
      ORDER BY cognome, nome 
      LIMIT 20
    `);

    console.log('\n📊 Statistiche aggiornamento ruoli:\n');
    console.log(`Politici con ruolo P (attualmente eletti): ${resultP.rows[0].totale}`);
    console.log(`Politici con ruolo E (non eletti): ${resultE.rows[0].totale}`);
    
    console.log('\n📋 Esempi politici con ruolo E:');
    esempiE.rows.forEach(p => {
      console.log(`  - ${p.nome} ${p.cognome} (${p.grado_elezione})`);
    });

    // Verifica alcuni politici specifici che dovrebbero essere E
    const verificaSpecifici = await pool.query(`
      SELECT nome, cognome, ruolo, grado_elezione 
      FROM users 
      WHERE (LOWER(TRIM(nome)) = LOWER(TRIM('Roberto')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Formigoni')))
         OR (LOWER(TRIM(nome)) = LOWER(TRIM('Luigi')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Di Maio')))
         OR (LOWER(TRIM(nome)) = LOWER(TRIM('Pier Luigi')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bersani')))
      ORDER BY cognome
    `);

    if (verificaSpecifici.rows.length > 0) {
      console.log('\n🔍 Verifica politici specifici:');
      verificaSpecifici.rows.forEach(p => {
        console.log(`  - ${p.nome} ${p.cognome}: ruolo=${p.ruolo}, grado=${p.grado_elezione}`);
      });
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

verificaRuoli();
