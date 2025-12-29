const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addTipologieAttivismoColumn() {
  console.log('🚀 Inizio aggiunta colonna tipologie_attivismo...');
  
  try {
    // Verifica se la colonna esiste già
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'tipologie_attivismo'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Colonna tipologie_attivismo esiste già');
      return;
    }
    
    // Aggiungi la colonna
    console.log('📝 Aggiungendo colonna tipologie_attivismo...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN tipologie_attivismo JSONB DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ Colonna tipologie_attivismo aggiunta con successo');
    
    // Crea indice GIN per performance ottimali
    console.log('📊 Creando indice GIN per tipologie_attivismo...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tipologie_attivismo_gin 
      ON users USING GIN (tipologie_attivismo)
    `);
    
    console.log('✅ Indice GIN creato con successo');
    
    // Verifica la struttura aggiornata
    const structure = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'tipologie_attivismo'
    `);
    
    console.log('📋 Struttura colonna:');
    structure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
    });
    
    // Test con alcuni dati di esempio
    console.log('🧪 Test con dati di esempio...');
    
    // Esempio di tipologie di attivismo
    const tipologieEsempio = [
      {
        tipo: "ambiente",
        emoji: "🌱",
        nome: "Ambiente e Sostenibilità"
      },
      {
        tipo: "diritti_umani",
        emoji: "🤝", 
        nome: "Diritti Umani"
      },
      {
        tipo: "educazione",
        emoji: "📚",
        nome: "Educazione"
      }
    ];
    
    // Trova un utente attivista per il test
    const testUser = await pool.query(`
      SELECT id, nome, cognome 
      FROM users 
      WHERE ruolo = 'Attivista' 
      LIMIT 1
    `);
    
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].id;
      console.log(`👤 Test con utente: ${testUser.rows[0].nome} ${testUser.rows[0].cognome}`);
      
      // Aggiorna con dati di esempio
      await pool.query(`
        UPDATE users 
        SET tipologie_attivismo = $1 
        WHERE id = $2
      `, [JSON.stringify(tipologieEsempio), userId]);
      
      console.log('✅ Dati di esempio inseriti');
      
      // Verifica il risultato
      const result = await pool.query(`
        SELECT tipologie_attivismo 
        FROM users 
        WHERE id = $1
      `, [userId]);
      
      console.log('📊 Risultato test:');
      console.log(JSON.stringify(result.rows[0].tipologie_attivismo, null, 2));
      
      // Test query per tipologia
      const queryTest = await pool.query(`
        SELECT nome, cognome, tipologie_attivismo
        FROM users 
        WHERE tipologie_attivismo @> '[{"tipo": "ambiente"}]'
      `);
      
      console.log(`🔍 Query test - Attivisti ambiente: ${queryTest.rows.length}`);
    } else {
      console.log('⚠️ Nessun attivista trovato per il test');
    }
    
    console.log('🎉 Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui la migrazione
addTipologieAttivismoColumn()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
