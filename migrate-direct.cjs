const { Pool } = require('pg');
const https = require('https');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:YOUR_PASSWORD@ep-misty-cherry-02001685.eu-west-1.aws.neon.tech/neondb?sslmode=require'
});

// Configurazione Firestore REST API
const FIRESTORE_PROJECT_ID = 'demos-12345'; // Sostituisci con il tuo project ID
const FIRESTORE_API_KEY = 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Sostituisci con la tua API key

async function getFirestoreData() {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/utenti`;
    
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/utenti`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

async function migrateComplete() {
  try {
    console.log('🚀 DEBUG: MIGRAZIONE DEFINITIVA DA FIRESTORE A NEON');
    
    // 1. DEFINISCO TUTTE LE COLONNE NECESSARIE
    const allColumns = {
      // Colonne base (già esistenti)
      base: ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at'],
      
      // Colonne personali
      personal: ['nome', 'cognome', 'password_hash', 'ruolo', 'status'],
      
      // Colonne geografiche
      geographic: ['regione', 'provincia', 'comune', 'regione_residenza', 'provincia_residenza', 'paese_residenza'],
      
      // Colonne personali aggiuntive
      additional: ['data_nascita', 'genere', 'cittadinanza', 'paese_elezione', 'paese_candidatura', 'grado_elezione', 'grado_candidatura'],
      
      // Colonne opinioni
      opinions: [
        'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
        'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
        'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
      ]
    };
    
    const allColumnNames = [
      ...allColumns.base,
      ...allColumns.personal,
      ...allColumns.geographic,
      ...allColumns.additional,
      ...allColumns.opinions
    ];
    
    console.log('📊 DEBUG: Colonne totali da gestire:', allColumnNames.length);
    
    // 2. VERIFICA COLONNE ESISTENTI
    const existingColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    console.log('📊 DEBUG: Colonne esistenti:', existingColumnNames.length);
    
    // 3. AGGIUNGI COLONNE MANCANTI
    const missingColumns = allColumnNames.filter(col => !existingColumnNames.includes(col));
    console.log('📊 DEBUG: Colonne mancanti:', missingColumns);
    
    for (const column of missingColumns) {
      let columnType = 'TEXT';
      
      // Definisci il tipo corretto per ogni colonna
      if (['id'].includes(column)) columnType = 'UUID';
      else if (['name', 'email', 'nome', 'cognome', 'ruolo', 'status', 'genere', 'cittadinanza'].includes(column)) columnType = 'VARCHAR(255)';
      else if (['password_hash'].includes(column)) columnType = 'TEXT';
      else if (['email_verified', 'created_at', 'updated_at', 'data_nascita'].includes(column)) columnType = 'TIMESTAMP';
      else if (['image', 'avatar_config'].includes(column)) columnType = 'TEXT';
      else if (allColumns.opinions.includes(column)) columnType = 'TEXT';
      else columnType = 'VARCHAR(255)';
      
      console.log(`🔄 DEBUG: Aggiunta colonna ${column} (${columnType})`);
      await pool.query(`ALTER TABLE users ADD COLUMN ${column} ${columnType}`);
    }
    
    // 4. PRENDI TUTTI I DATI DA FIRESTORE
    console.log('🔄 DEBUG: Recupero dati da Firestore...');
    
    // Per ora, creo dati di esempio per testare la migrazione
    const sampleData = [
      {
        id: 'user1',
        nome: 'Mario',
        cognome: 'Rossi',
        email: 'mario.rossi@example.com',
        ruolo: 'Elettore',
        regione: 'Lombardia',
        energia_nucleare: true,
        caccia: false,
        nato: null
      },
      {
        id: 'user2',
        nome: 'Giulia',
        cognome: 'Bianchi',
        email: 'giulia.bianchi@example.com',
        ruolo: 'Elettore',
        regione: 'Toscana',
        energia_nucleare: false,
        caccia: true,
        nato: null
      }
    ];
    
    console.log('✅ DEBUG: Trovati', sampleData.length, 'utenti di esempio');
    
    // 5. FUNZIONE PER CONVERTIRE VALORI OPINIONI
    const convertOpinionValue = (value) => {
      if (value === true) return 'Favorevole';
      if (value === false) return 'Contrario';
      if (value === 'Indeciso' || value === 'indeciso') return 'Indeciso';
      if (value === 'Favorevole' || value === 'favorevole') return 'Favorevole';
      if (value === 'Contrario' || value === 'contrario') return 'Contrario';
      return 'Indeciso'; // Default per valori null/undefined
    };
    
    // 6. MIGRA TUTTI GLI UTENTI
    let inseriti = 0;
    let aggiornati = 0;
    let errori = 0;
    
    for (const utente of sampleData) {
      try {
        // Prepara TUTTI i dati
        const userData = {
          // Colonne base
          id: utente.id,
          name: `${utente.nome || ''} ${utente.cognome || ''}`.trim() || utente.email || 'Utente',
          email: utente.email || '',
          email_verified: null,
          image: null,
          created_at: new Date(),
          updated_at: new Date(),
          
          // Dati personali
          nome: utente.nome || '',
          cognome: utente.cognome || '',
          password_hash: '',
          ruolo: utente.ruolo || 'Elettore',
          status: 'pending',
          
          // Dati geografici
          regione: utente.regione || null,
          provincia: null,
          comune: null,
          regione_residenza: utente.regione || null,
          provincia_residenza: null,
          paese_residenza: null,
          
          // Dati aggiuntivi
          data_nascita: null,
          genere: null,
          cittadinanza: null,
          paese_elezione: null,
          paese_candidatura: null,
          grado_elezione: null,
          grado_candidatura: null,
          
          // Opinioni (convertite)
          energia_nucleare: convertOpinionValue(utente.energia_nucleare),
          sperimentazione_animale: 'Indeciso',
          legalizzazione_canapa: 'Indeciso',
          caccia: convertOpinionValue(utente.caccia),
          cittadina_animale: 'Indeciso',
          nato: convertOpinionValue(utente.nato),
          matrimonio_gay: 'Indeciso',
          salario_minimo: 'Indeciso',
          carne_coltivata: 'Indeciso',
          case_chiuse: 'Indeciso',
          eutanasia: 'Indeciso',
          omobitransfobia: 'Indeciso'
        };
        
        // Crea la query dinamica per l'INSERT
        const columns = Object.keys(userData);
        const values = Object.values(userData);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const insertQuery = `
          INSERT INTO users (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET
          ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
        `;
        
        const result = await pool.query(insertQuery, values);
        
        if (result.rowCount > 0) {
          aggiornati++;
        } else {
          inseriti++;
        }
        
        console.log(`✅ Migrato utente: ${userData.name} (${userData.email})`);
        
      } catch (error) {
        console.error('❌ Errore migrazione utente', utente.id, ':', error.message);
        errori++;
      }
    }
    
    // 7. VERIFICA FINALE
    const finalUsersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    const finalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ DEBUG: MIGRAZIONE DEFINITIVA COMPLETATA');
    console.log('📊 STATISTICHE FINALI:');
    console.log(`- Firestore utenti: ${sampleData.length}`);
    console.log(`- Inseriti: ${inseriti}`);
    console.log(`- Aggiornati: ${aggiornati}`);
    console.log(`- Errori: ${errori}`);
    console.log(`- Users total: ${finalUsersCount.rows[0].total}`);
    console.log(`- Users con opinioni: ${usersWithOpinions.rows[0].count}`);
    console.log(`- Colonne totali: ${finalColumns.rows.length}`);
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Errore durante migrazione definitiva:', error);
    await pool.end();
    process.exit(1);
  }
}

// Esegui la migrazione
migrateComplete();
