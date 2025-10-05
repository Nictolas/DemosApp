const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addTwitchYouTubeColumns() {
  try {
    console.log('🔧 Aggiungendo colonne Twitch e YouTube alla tabella users...');

    // Aggiungi colonne Twitch e YouTube
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS twitch_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(255)
    `);

    console.log('✅ Colonne Twitch e YouTube aggiunte con successo!');

    // Verifica le colonne aggiunte
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('twitch_url', 'youtube_url')
      ORDER BY column_name
    `);

    console.log('📋 Colonne social aggiunte:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Errore nell\'aggiunta delle colonne Twitch e YouTube:', error);
  } finally {
    await pool.end();
  }
}

addTwitchYouTubeColumns();
