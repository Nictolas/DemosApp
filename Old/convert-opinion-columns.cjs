require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function convertOpinionColumns() {
  try {
    console.log('🔄 DEBUG: CONVERSIONE COLONNE OPINIONI DA BOOLEAN A TEXT');
    
    // Lista delle colonne opinioni
    const opinionColumns = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    // Verifica il tipo attuale di ogni colonna
    for (const column of opinionColumns) {
      try {
        const columnInfo = await pool.query(`
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = $1
        `, [column]);
        
        if (columnInfo.rows.length > 0) {
          const currentType = columnInfo.rows[0].data_type;
          console.log(`📊 Colonna ${column}: ${currentType}`);
          
          if (currentType === 'boolean') {
            console.log(`🔄 Conversione ${column} da boolean a TEXT...`);
            
            // Crea una colonna temporanea
            await pool.query(`ALTER TABLE users ADD COLUMN ${column}_temp TEXT`);
            
            // Copia i dati convertendo boolean a stringhe
            await pool.query(`
              UPDATE users 
              SET ${column}_temp = CASE 
                WHEN ${column} = true THEN 'Favorevole'
                WHEN ${column} = false THEN 'Contrario'
                ELSE 'Indeciso'
              END
            `);
            
            // Rimuovi la colonna originale
            await pool.query(`ALTER TABLE users DROP COLUMN ${column}`);
            
            // Rinomina la colonna temporanea
            await pool.query(`ALTER TABLE users RENAME COLUMN ${column}_temp TO ${column}`);
            
            console.log(`✅ ${column} convertita con successo`);
          } else {
            console.log(`✅ ${column} già di tipo ${currentType}`);
          }
        } else {
          console.log(`⚠️ Colonna ${column} non trovata`);
        }
      } catch (error) {
        console.error(`❌ Errore conversione ${column}:`, error.message);
      }
    }
    
    // Verifica finale
    console.log('\n📊 VERIFICA FINALE:');
    for (const column of opinionColumns) {
      const columnInfo = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [column]);
      
      if (columnInfo.rows.length > 0) {
        console.log(`${column}: ${columnInfo.rows[0].data_type}`);
      }
    }
    
    await pool.end();
    console.log('✅ CONVERSIONE COMPLETATA');
    
  } catch (error) {
    console.error('❌ Errore durante conversione:', error);
    await pool.end();
  }
}

convertOpinionColumns();
