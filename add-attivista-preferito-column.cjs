const { Pool } = require('pg');
require('dotenv').config();

// Verifica che DATABASE_URL sia definito
if (!process.env.DATABASE_URL) {
  console.error('❌ ERRORE: DATABASE_URL non è definito nel file .env');
  console.log('💡 Suggerimento: Esegui questo script sul server o configura DATABASE_URL nel file .env');
  process.exit(1);
}

// Configurazione database
const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

console.log('🔍 DATABASE_URL presente:', !!dbUrl);
console.log('🔍 Tipo URL:', typeof dbUrl);
console.log('🔍 Primi 50 caratteri:', dbUrl ? dbUrl.substring(0, 50) : 'null');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function addAttivistiOrganizzazioniColumns() {
  console.log('🚀 Inizio aggiunta colonne attivisti e organizzazioni...');
  console.log('🔗 Connessione al database:', process.env.DATABASE_URL.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')); // Nasconde credenziali
  
  try {
    // Verifica se le colonne esistono già
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('attivisti', 'organizzazioni')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    
    // Aggiungi colonna attivisti se non esiste
    if (!existingColumns.includes('attivisti')) {
      console.log('📝 Aggiungendo colonna attivisti...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN attivisti VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Colonna attivisti aggiunta con successo');
      
      // Aggiungi foreign key constraint
      console.log('🔗 Aggiungendo foreign key constraint per attivisti...');
      await pool.query(`
        ALTER TABLE users 
        ADD CONSTRAINT fk_attivisti 
        FOREIGN KEY (attivisti) REFERENCES users(id)
      `);
      console.log('✅ Foreign key constraint per attivisti aggiunto');
      
      // Crea indice per performance
      console.log('📊 Creando indice per attivisti...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_attivisti 
        ON users (attivisti)
      `);
      console.log('✅ Indice per attivisti creato');
    } else {
      console.log('✅ Colonna attivisti esiste già');
    }
    
    // Aggiungi colonna organizzazioni se non esiste
    if (!existingColumns.includes('organizzazioni')) {
      console.log('📝 Aggiungendo colonna organizzazioni...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN organizzazioni VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Colonna organizzazioni aggiunta con successo');
      
      // Aggiungi foreign key constraint
      console.log('🔗 Aggiungendo foreign key constraint per organizzazioni...');
      await pool.query(`
        ALTER TABLE users 
        ADD CONSTRAINT fk_organizzazioni 
        FOREIGN KEY (organizzazioni) REFERENCES users(id)
      `);
      console.log('✅ Foreign key constraint per organizzazioni aggiunto');
      
      // Crea indice per performance
      console.log('📊 Creando indice per organizzazioni...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_organizzazioni 
        ON users (organizzazioni)
      `);
      console.log('✅ Indice per organizzazioni creato');
    } else {
      console.log('✅ Colonna organizzazioni esiste già');
    }
    
    // Verifica la struttura aggiornata
    const structure = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('attivisti', 'organizzazioni')
      ORDER BY column_name
    `);
    
    console.log('📋 Struttura colonne:');
    structure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (default: ${col.column_default}, nullable: ${col.is_nullable})`);
    });
    
    // Verifica constraint
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
      AND constraint_name IN ('fk_attivisti', 'fk_organizzazioni')
      ORDER BY constraint_name
    `);
    
    console.log('🔗 Constraint verificati:');
    constraints.rows.forEach(constraint => {
      console.log(`- ${constraint.constraint_name}: ${constraint.constraint_type}`);
    });
    
    console.log('🎉 Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui la migrazione
addAttivistiOrganizzazioniColumns()
  .then(() => {
    console.log('✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
