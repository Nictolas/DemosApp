require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non trovato nelle variabili d\'ambiente');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

async function addUniqueConstraint() {
  const client = await pool.connect();
  try {
    console.log('🔧 Aggiunta constraint UNIQUE per prevenire duplicati...');
    
    // Prima, rimuovi eventuali duplicati esistenti
    console.log('🧹 Rimozione duplicati esistenti...');
    const removeDuplicatesQuery = `
      DELETE FROM opinioni_domande a
      USING opinioni_domande b
      WHERE a.id < b.id
      AND LOWER(TRIM(a.text)) = LOWER(TRIM(b.text))
      AND 'da approvare' = ANY(a.gradi_opinione)
      AND 'da approvare' = ANY(b.gradi_opinione)
    `;
    
    const deleteResult = await client.query(removeDuplicatesQuery);
    console.log(`✅ Rimossi ${deleteResult.rowCount} duplicati`);
    
    // Crea un indice UNIQUE parziale per opinioni "da approvare"
    // Questo previene duplicati a livello database
    console.log('📊 Creazione indice UNIQUE...');
    const createIndexQuery = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_opinioni_domande_text_unique_da_approvare
      ON opinioni_domande (LOWER(TRIM(text)))
      WHERE 'da approvare' = ANY(gradi_opinione)
    `;
    
    await client.query(createIndexQuery);
    console.log('✅ Indice UNIQUE creato con successo');
    
  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addUniqueConstraint()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore nello script:', error);
    process.exit(1);
  });

