const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addMissingColumns() {
  try {
    console.log('🔍 Aggiunta colonne mancanti alla tabella users...');
    
    // Aggiungi is_admin se non esiste
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Colonna is_admin aggiunta');
    } catch (error) {
      console.log('⚠️ Errore aggiunta is_admin:', error.message);
    }
    
    // Aggiungi is_premium se non esiste (per compatibilità)
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Colonna is_premium aggiunta');
    } catch (error) {
      console.log('⚠️ Errore aggiunta is_premium:', error.message);
    }
    
    // Sincronizza is_premium con premium
    try {
      await pool.query(`
        UPDATE users 
        SET is_premium = COALESCE(premium, FALSE)
        WHERE is_premium IS NULL
      `);
      console.log('✅ Sincronizzazione is_premium con premium completata');
    } catch (error) {
      console.log('⚠️ Errore sincronizzazione is_premium:', error.message);
    }
    
    // Imposta is_admin = true per utenti con ruolo admin
    try {
      await pool.query(`
        UPDATE users 
        SET is_admin = TRUE
        WHERE ruolo = 'admin' OR ruolo = 'Admin'
      `);
      console.log('✅ is_admin impostato per utenti admin');
    } catch (error) {
      console.log('⚠️ Errore impostazione is_admin:', error.message);
    }
    
    // Verifica finale
    const finalStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('is_admin', 'is_premium', 'premium', 'ruolo')
        AND table_schema = 'public'
      ORDER BY column_name
    `);
    
    console.log('\n📋 Colonne verificate:');
    finalStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Conta admin
    const adminCount = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE
    `);
    console.log(`\n👑 Utenti admin: ${adminCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta colonne:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addMissingColumns()
  .then(() => {
    console.log('🎉 Aggiunta colonne completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante l\'aggiunta:', error);
    process.exit(1);
  });