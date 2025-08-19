require('dotenv').config();
const { Pool } = require('pg');
const admin = require('firebase-admin');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

// Configurazione Firestore - usa direttamente il file JSON
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function migrateUtentiToNeon() {
  try {
    console.log('🔧 DEBUG: MIGRAZIONE UTENTI DA FIRESTORE A NEON');
    
    // 1. VERIFICA STRUTTURA TABELLA UTENTI
    console.log('🔄 Verifica struttura tabella utenti...');
    
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'utenti' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Colonne trovate in utenti:', columnsResult.rows.length);
    columnsResult.rows.forEach(col => {
      console.log(`   📋 ${col.column_name}: ${col.data_type}`);
    });
    
    // 2. PRENDI TUTTI GLI UTENTI DA FIRESTORE
    console.log('🔄 Recupero utenti da Firestore...');
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      console.log('⚠️ Nessun utente trovato in Firestore');
      await pool.end();
      return;
    }
    
    console.log(`📊 Trovati ${utentiSnapshot.size} utenti in Firestore`);
    
    // 3. MIGRA OGNI UTENTE
    let inseriti = 0;
    let errori = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        const firestoreId = doc.id;
        
        // Prepara i dati per l'inserimento
        const userData = {
          id: firestoreId,
          email: utente.email || '',
          nome: utente.nome || '',
          cognome: utente.cognome || '',
          password_hash: utente.password_hash || '',
          ruolo: utente.ruolo || 'Elettore',
          status: utente.status || 'pending',
          avatar_config: utente.avatar_config ? JSON.stringify(utente.avatar_config) : null,
          regione: utente.regione || null,
          provincia: utente.provincia || null,
          comune: utente.comune || null,
          data_nascita: utente.data_nascita ? new Date(utente.data_nascita) : null,
          genere: utente.genere || null,
          cittadinanza: utente.cittadinanza || null,
          paese_residenza: utente.paese_residenza || null,
          paese_elezione: utente.paese_elezione || null,
          paese_candidatura: utente.paese_candidatura || null,
          grado_elezione: utente.grado_elezione || null,
          grado_candidatura: utente.grado_candidatura || null,
          // Opinioni (convertite da boolean a text)
          energia_nucleare: convertOpinionValue(utente.energia_nucleare),
          sperimentazione_animale: convertOpinionValue(utente.sperimentazione_animale),
          legalizzazione_canapa: convertOpinionValue(utente.legalizzazione_canapa),
          caccia: convertOpinionValue(utente.caccia),
          cittadina_animale: convertOpinionValue(utente.cittadina_animale),
          nato: convertOpinionValue(utente.nato),
          matrimonio_gay: convertOpinionValue(utente.matrimonio_gay),
          salario_minimo: convertOpinionValue(utente.salario_minimo),
          carne_coltivata: convertOpinionValue(utente.carne_coltivata),
          case_chiuse: convertOpinionValue(utente.case_chiuse),
          eutanasia: convertOpinionValue(utente.eutanasia),
          omobitransfobia: convertOpinionValue(utente.omobitransfobia),
          created_at: utente.created_at ? new Date(utente.created_at) : new Date(),
          updated_at: utente.updated_at ? new Date(utente.updated_at) : new Date()
        };
        
        // Inserisci l'utente in Neon (semplificato)
        const insertQuery = `
          INSERT INTO utenti (
            id, email, nome, cognome, password_hash, ruolo, status, avatar_config,
            regione, provincia, comune, data_nascita, genere, cittadinanza,
            paese_residenza, paese_elezione, paese_candidatura, grado_elezione, grado_candidatura,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
            cittadina_animale, nato, matrimonio_gay, salario_minimo, carne_coltivata,
            case_chiuse, eutanasia, omobitransfobia, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
        `;
        
        await pool.query(insertQuery, [
          userData.id, userData.email, userData.nome, userData.cognome, userData.password_hash,
          userData.ruolo, userData.status, userData.avatar_config, userData.regione, userData.provincia,
          userData.comune, userData.data_nascita, userData.genere, userData.cittadinanza,
          userData.paese_residenza, userData.paese_elezione, userData.paese_candidatura,
          userData.grado_elezione, userData.grado_candidatura, userData.energia_nucleare,
          userData.sperimentazione_animale, userData.legalizzazione_canapa, userData.caccia,
          userData.cittadina_animale, userData.nato, userData.matrimonio_gay, userData.salario_minimo,
          userData.carne_coltivata, userData.case_chiuse, userData.eutanasia, userData.omobitransfobia,
          userData.created_at, userData.updated_at
        ]);
        
        inseriti++;
        console.log(`✅ Utente migrato: ${userData.nome} ${userData.cognome} (${userData.email})`);
        
      } catch (error) {
        console.error(`❌ Errore migrazione utente ${doc.id}:`, error.message);
        errori++;
      }
    }
    
    // 4. VERIFICA FINALE
    console.log('\n📊 VERIFICA FINALE:');
    
    const finalCount = await pool.query('SELECT COUNT(*) as total FROM utenti');
    console.log(`📊 Totale utenti in Neon: ${finalCount.rows[0].total}`);
    
    // 5. MOSTRA ALCUNI ESEMPI
    console.log('\n📊 ESEMPI UTENTI MIGRATI:');
    const sampleUsers = await pool.query(`
      SELECT id, nome, cognome, email, ruolo, status, 
             energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia
      FROM utenti
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    sampleUsers.rows.forEach(user => {
      console.log(`👤 ${user.nome} ${user.cognome} (${user.email})`);
      console.log(`   🏷️ Ruolo: ${user.ruolo}, Status: ${user.status}`);
      console.log(`   💭 Opinioni: energia=${user.energia_nucleare}, sperimentazione=${user.sperimentazione_animale}, canapa=${user.legalizzazione_canapa}, caccia=${user.caccia}`);
      console.log('---');
    });
    
    console.log('\n✅ MIGRAZIONE UTENTI COMPLETATA');
    console.log(`📊 STATISTICHE: ${inseriti} inseriti, ${errori} errori`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    await pool.end();
  }
}

// Funzione per convertire valori boolean delle opinioni in text
function convertOpinionValue(value) {
  if (value === true) return 'Favorevole';
  if (value === false) return 'Contrario';
  if (value === null || value === undefined) return null;
  return value.toString();
}

migrateUtentiToNeon();
