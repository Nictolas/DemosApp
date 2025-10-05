const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addSocialColumns() {
  try {
    console.log('🔧 Aggiungendo colonne social media alla tabella users...');

    // Aggiungi colonne social media
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS telegram_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS website_url VARCHAR(255)
    `);

    console.log('✅ Colonne social media aggiunte con successo!');

    // Aggiorna gli attivisti esistenti con URL social di esempio
    await pool.query(`
      UPDATE users 
      SET 
        facebook_url = CASE 
          WHEN nome = 'Marco' AND cognome = 'Rossi' THEN 'https://facebook.com/marco.rossi'
          WHEN nome = 'Sara' AND cognome = 'Bianchi' THEN 'https://facebook.com/sara.bianchi'
          WHEN nome = 'Luca' AND cognome = 'Verdi' THEN 'https://facebook.com/luca.verdi'
          ELSE NULL
        END,
        twitter_url = CASE 
          WHEN nome = 'Marco' AND cognome = 'Rossi' THEN 'https://twitter.com/marco_rossi'
          WHEN nome = 'Sara' AND cognome = 'Bianchi' THEN 'https://twitter.com/sara_bianchi'
          WHEN nome = 'Luca' AND cognome = 'Verdi' THEN 'https://twitter.com/luca_verdi'
          ELSE NULL
        END,
        instagram_url = CASE 
          WHEN nome = 'Marco' AND cognome = 'Rossi' THEN 'https://instagram.com/marco.rossi'
          WHEN nome = 'Sara' AND cognome = 'Bianchi' THEN 'https://instagram.com/sara.bianchi'
          WHEN nome = 'Luca' AND cognome = 'Verdi' THEN 'https://instagram.com/luca.verdi'
          ELSE NULL
        END,
        linkedin_url = CASE 
          WHEN nome = 'Marco' AND cognome = 'Rossi' THEN 'https://linkedin.com/in/marco-rossi'
          WHEN nome = 'Sara' AND cognome = 'Bianchi' THEN 'https://linkedin.com/in/sara-bianchi'
          WHEN nome = 'Luca' AND cognome = 'Verdi' THEN 'https://linkedin.com/in/luca-verdi'
          ELSE NULL
        END
      WHERE ruolo = 'Attivista'
    `);

    console.log('✅ URL social di esempio aggiunti agli attivisti!');

    // Verifica le colonne aggiunte
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name LIKE '%_url'
      ORDER BY column_name
    `);

    console.log('📋 Colonne social aggiunte:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Verifica i dati degli attivisti
    const attivisti = await pool.query(`
      SELECT nome, cognome, facebook_url, twitter_url, instagram_url, linkedin_url
      FROM users 
      WHERE ruolo = 'Attivista'
      ORDER BY nome
    `);

    console.log('👥 Attivisti con social media:');
    attivisti.rows.forEach(attivista => {
      console.log(`  ${attivista.nome} ${attivista.cognome}:`);
      if (attivista.facebook_url) console.log(`    Facebook: ${attivista.facebook_url}`);
      if (attivista.twitter_url) console.log(`    Twitter: ${attivista.twitter_url}`);
      if (attivista.instagram_url) console.log(`    Instagram: ${attivista.instagram_url}`);
      if (attivista.linkedin_url) console.log(`    LinkedIn: ${attivista.linkedin_url}`);
    });

  } catch (error) {
    console.error('❌ Errore nell\'aggiunta delle colonne social:', error);
  } finally {
    await pool.end();
  }
}

addSocialColumns();
