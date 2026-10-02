require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function updateTable() {
  try {
    console.log('[*] Verifica struttura tabella voti_camera...');
    
    // Verifica colonne esistenti
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'voti_camera'
      ORDER BY ordinal_position
    `);
    
    console.log('\n[*] Colonne attuali:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Aggiungi colonne mancanti
    const colonneDaAggiungere = [
      { nome: 'camera', tipo: 'VARCHAR(50)', default: null, check: "CHECK (camera IN ('Camera', 'Senato'))" },
      { nome: 'url_openpolis', tipo: 'TEXT', default: null },
      { nome: 'votazione', tipo: 'TEXT', default: null },
      { nome: 'voto', tipo: 'VARCHAR(50)', default: null, check: "CHECK (voto IN ('In missione', 'Astenuto', 'Favorevole', 'Contrario'))" },
      { nome: 'ultimo_aggiornamento', tipo: 'TIMESTAMP', default: 'DEFAULT CURRENT_TIMESTAMP' },
    ];
    
    const colonneEsistenti = new Set(columns.rows.map(c => c.column_name));
    
    console.log('\n[*] Aggiunta colonne mancanti...');
    for (const col of colonneDaAggiungere) {
      if (!colonneEsistenti.has(col.nome)) {
        try {
          let query = `ALTER TABLE voti_camera ADD COLUMN ${col.nome} ${col.tipo}`;
          if (col.default) query += ` ${col.default}`;
          if (col.check) query += ` ${col.check}`;
          
          await pool.query(query);
          console.log(`[OK] Aggiunta colonna: ${col.nome}`);
        } catch (e) {
          console.log(`[!] Errore aggiunta ${col.nome}: ${e.message}`);
        }
      } else {
        console.log(`[!] Colonna ${col.nome} già esistente`);
      }
    }
    
    // Rinomina colonne se necessario
    const renameMap = {
      'oggetto_voto': 'votazione',
      'esito_voto': 'voto'
    };
    
    for (const [vecchio, nuovo] of Object.entries(renameMap)) {
      if (colonneEsistenti.has(vecchio) && !colonneEsistenti.has(nuovo)) {
        try {
          await pool.query(`ALTER TABLE voti_camera RENAME COLUMN ${vecchio} TO ${nuovo}`);
          console.log(`[OK] Rinominata colonna: ${vecchio} -> ${nuovo}`);
        } catch (e) {
          console.log(`[!] Errore rinomina ${vecchio}: ${e.message}`);
        }
      }
    }
    
    // Crea trigger se non esiste
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_voti_camera_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.ultimo_aggiornamento = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      
      await pool.query(`
        DROP TRIGGER IF EXISTS trigger_update_voti_camera_updated_at ON voti_camera;
        CREATE TRIGGER trigger_update_voti_camera_updated_at
          BEFORE UPDATE ON voti_camera
          FOR EACH ROW
          EXECUTE FUNCTION update_voti_camera_updated_at()
      `);
      console.log('[OK] Trigger creato');
    } catch (e) {
      console.log(`[!] Errore trigger: ${e.message}`);
    }
    
    console.log('\n[OK] Aggiornamento completato!');
    
  } catch (error) {
    console.error('[ERR] Errore:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateTable()
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { updateTable };


