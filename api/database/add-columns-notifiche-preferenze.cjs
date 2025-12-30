/**
 * Script per aggiungere le colonne mancanti alla tabella notifiche_preferenze
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function addColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Aggiunta colonne mancanti a notifiche_preferenze...\n');

    await client.query('BEGIN');

    // Aggiungi colonne per i diversi tipi di rappresentanti
    console.log('📝 Aggiunta colonne...');
    await client.query(`
      ALTER TABLE notifiche_preferenze 
        ADD COLUMN IF NOT EXISTS eurodeputato BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS senatore BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS deputato BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS consigliere_regionale BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS consigliere_comunale BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS attivisti BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS scuola BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS organizzazioni BOOLEAN DEFAULT false
    `);
    console.log('✅ Colonne aggiunte');

    // Rinomina avvistamenti in animali se esiste
    console.log('📝 Rinomina colonna avvistamenti -> animali...');
    try {
      const columnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'notifiche_preferenze' 
          AND column_name = 'avvistamenti'
        )
      `);
      
      if (columnExists.rows[0].exists) {
        await client.query('ALTER TABLE notifiche_preferenze RENAME COLUMN avvistamenti TO animali');
        console.log('✅ Colonna rinominata');
      } else {
        // Se non esiste avvistamenti, aggiungi animali se non esiste
        await client.query(`
          ALTER TABLE notifiche_preferenze 
          ADD COLUMN IF NOT EXISTS animali BOOLEAN DEFAULT true
        `);
        console.log('✅ Colonna animali aggiunta');
      }
    } catch (error) {
      console.warn('⚠️ Errore nella rinomina (probabilmente già rinominata):', error.message);
    }

    // Crea indici per le nuove colonne
    console.log('📝 Creazione indici...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_eurodeputato 
        ON notifiche_preferenze(eurodeputato) WHERE eurodeputato = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_senatore 
        ON notifiche_preferenze(senatore) WHERE senatore = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_deputato 
        ON notifiche_preferenze(deputato) WHERE deputato = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_consigliere_regionale 
        ON notifiche_preferenze(consigliere_regionale) WHERE consigliere_regionale = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_consigliere_comunale 
        ON notifiche_preferenze(consigliere_comunale) WHERE consigliere_comunale = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_attivisti 
        ON notifiche_preferenze(attivisti) WHERE attivisti = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_scuola 
        ON notifiche_preferenze(scuola) WHERE scuola = true;
      
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_organizzazioni 
        ON notifiche_preferenze(organizzazioni) WHERE organizzazioni = true;
    `);
    
    // Aggiorna indice per animali
    await client.query(`
      DROP INDEX IF EXISTS idx_notifiche_preferenze_avvistamenti;
      CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_animali 
        ON notifiche_preferenze(animali) WHERE animali = true;
    `);
    console.log('✅ Indici creati');

    // Mantieni retrocompatibilità: se istituzione è true, attiva tutte le preferenze rappresentanti
    console.log('📝 Aggiornamento retrocompatibilità...');
    const updateResult = await client.query(`
      UPDATE notifiche_preferenze 
      SET 
        eurodeputato = COALESCE(eurodeputato, istituzione),
        senatore = COALESCE(senatore, istituzione),
        deputato = COALESCE(deputato, istituzione),
        consigliere_regionale = COALESCE(consigliere_regionale, istituzione),
        consigliere_comunale = COALESCE(consigliere_comunale, istituzione)
      WHERE istituzione = true
    `);
    console.log(`✅ ${updateResult.rowCount} record aggiornati per retrocompatibilità`);

    await client.query('COMMIT');

    console.log('\n✅ Script completato con successo!');
    console.log('\n📊 Colonne disponibili nella tabella:');
    const columns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifiche_preferenze'
      ORDER BY ordinal_position
    `);
    
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore durante l\'esecuzione:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui lo script
addColumns()
  .then(() => {
    console.log('\n✅ Operazione completata!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Operazione fallita:', error);
    process.exit(1);
  });


