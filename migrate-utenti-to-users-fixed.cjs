const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateUtentiToUsers() {
  try {
    console.log('🔍 Inizio migrazione da utenti a users...');
    
    // 1. Ottieni tutti i dati dalla tabella utenti
    const utentiData = await pool.query('SELECT * FROM utenti');
    console.log(`📊 Trovati ${utentiData.rows.length} record in utenti`);
    
    if (utentiData.rows.length === 0) {
      console.log('⚠️ Nessun dato da migrare');
      return;
    }
    
    // 2. Mappa i campi da utenti a users
    for (const utente of utentiData.rows) {
      console.log(`🔄 Migrazione utente: ${utente.email || utente.id}`);
      
      // Controlla se l'utente esiste già in users per email
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [utente.email]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`  ⚠️ Utente già esistente in users, aggiorno...`);
        
        // Aggiorna l'utente esistente
        await pool.query(`
          UPDATE users SET 
            nome = COALESCE($1, nome),
            cognome = COALESCE($2, cognome),
            data_nascita = COALESCE($3, data_nascita),
            genere = COALESCE($4, genere),
            cittadinanza = COALESCE($5, cittadinanza),
            paese_residenza = COALESCE($6, paese_residenza),
            regione_residenza = COALESCE($7, regione_residenza),
            provincia_residenza = COALESCE($8, provincia_residenza),
            comune_residenza = COALESCE($9, comune_residenza),
            paese_elezione = COALESCE($10, paese_elezione),
            regione_elezione = COALESCE($11, regione_elezione),
            provincia_elezione = COALESCE($12, provincia_elezione),
            comune_elezione = COALESCE($13, comune_elezione),
            grado_elezione = COALESCE($14, grado_elezione),
            paese_candidatura = COALESCE($15, paese_candidatura),
            regione_candidatura = COALESCE($16, regione_candidatura),
            provincia_candidatura = COALESCE($17, provincia_candidatura),
            comune_candidatura = COALESCE($18, comune_candidatura),
            grado_candidatura = COALESCE($19, grado_candidatura),
            candidato_attivo = COALESCE($20, candidato_attivo),
            status_candidatura = COALESCE($21, status_candidatura),
            data_candidatura = COALESCE($22, data_candidatura),
            note_candidatura = COALESCE($23, note_candidatura),
            premium = COALESCE($24, premium),
            energia_nucleare = COALESCE($25, energia_nucleare),
            sperimentazione_animale = COALESCE($26, sperimentazione_animale),
            legalizzazione_canapa = COALESCE($27, legalizzazione_canapa),
            caccia = COALESCE($28, caccia),
            carne_coltivata = COALESCE($29, carne_coltivata),
            nato = COALESCE($30, nato),
            matrimonio_gay = COALESCE($31, matrimonio_gay),
            salario_minimo = COALESCE($32, salario_minimo),
            case_chiuse = COALESCE($33, case_chiuse),
            eutanasia = COALESCE($34, eutanasia),
            omobitransfobia = COALESCE($35, omobitransfobia),
            updated_at = CURRENT_TIMESTAMP
          WHERE email = $36
        `, [
          utente.nome,
          utente.cognome,
          utente.data_nascita,
          utente.sesso,
          utente.cittadinanza,
          utente.paese,
          utente.regione,
          utente.provincia,
          utente.comune,
          utente.paese_elezione,
          utente.regione_elezione,
          utente.provincia_elezione,
          utente.comune_elezione,
          utente.grado_elezione,
          utente.paese_candidatura,
          utente.regione_candidatura,
          utente.provincia_candidatura,
          utente.comune_candidatura,
          utente.grado_candidatura,
          utente.candidato_attivo,
          utente.status_candidatura,
          utente.data_candidatura,
          utente.note_candidatura,
          utente.is_premium,
          utente.energia_nucleare,
          utente.sperimentazione_animale,
          utente.legalizzazione_canapa,
          utente.caccia,
          utente.carne_coltivata,
          utente.nato,
          utente.matrimonio_gay,
          utente.salario_minimo,
          utente.case_chiuse,
          utente.eutanasia,
          utente.omobitransfobia,
          utente.email
        ]);
      } else {
        console.log(`  ➕ Creazione nuovo utente in users...`);
        
        // Genera un nuovo UUID per l'utente
        const newId = require('crypto').randomUUID();
        
        // Crea nuovo utente
        await pool.query(`
          INSERT INTO users (
            id, email, nome, cognome, data_nascita, genere, cittadinanza,
            paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
            paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_elezione,
            paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, grado_candidatura,
            candidato_attivo, status_candidatura, data_candidatura, note_candidatura,
            premium, energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
            carne_coltivata, nato, matrimonio_gay, salario_minimo, case_chiuse, eutanasia, omobitransfobia,
            status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
          )
        `, [
          newId,
          utente.email,
          utente.nome,
          utente.cognome,
          utente.data_nascita,
          utente.sesso,
          utente.cittadinanza,
          utente.paese,
          utente.regione,
          utente.provincia,
          utente.comune,
          utente.paese_elezione,
          utente.regione_elezione,
          utente.provincia_elezione,
          utente.comune_elezione,
          utente.grado_elezione,
          utente.paese_candidatura,
          utente.regione_candidatura,
          utente.provincia_candidatura,
          utente.comune_candidatura,
          utente.grado_candidatura,
          utente.candidato_attivo,
          utente.status_candidatura,
          utente.data_candidatura,
          utente.note_candidatura,
          utente.is_premium,
          utente.energia_nucleare,
          utente.sperimentazione_animale,
          utente.legalizzazione_canapa,
          utente.caccia,
          utente.carne_coltivata,
          utente.nato,
          utente.matrimonio_gay,
          utente.salario_minimo,
          utente.case_chiuse,
          utente.eutanasia,
          utente.omobitransfobia,
          utente.status || 'active',
          utente.created_at || new Date(),
          new Date()
        ]);
        
        // Salva il mapping tra vecchio ID e nuovo ID per aggiornare le foreign key
        await pool.query(`
          CREATE TEMP TABLE IF NOT EXISTS id_mapping (
            old_id VARCHAR(255),
            new_id UUID
          )
        `);
        
        await pool.query(
          'INSERT INTO id_mapping (old_id, new_id) VALUES ($1, $2)',
          [utente.id, newId]
        );
      }
    }
    
    console.log('✅ Migrazione dati completata');
    
    // 3. Aggiorna le foreign key delle tabelle dipendenti
    console.log('🔗 Aggiornamento foreign key...');
    
    // consenso_governo
    await pool.query(`
      UPDATE consenso_governo 
      SET userid = (SELECT new_id FROM id_mapping WHERE old_id = consenso_governo.userid)
      WHERE userid IN (SELECT old_id FROM id_mapping)
    `);
    console.log('  ✅ consenso_governo aggiornata');
    
    // consenso_capo_stato
    await pool.query(`
      UPDATE consenso_capo_stato 
      SET userid = (SELECT new_id FROM id_mapping WHERE old_id = consenso_capo_stato.userid)
      WHERE userid IN (SELECT old_id FROM id_mapping)
    `);
    console.log('  ✅ consenso_capo_stato aggiornata');
    
    // notifiche_utente
    await pool.query(`
      UPDATE notifiche_utente 
      SET utente_id = (SELECT new_id FROM id_mapping WHERE old_id = notifiche_utente.utente_id)
      WHERE utente_id IN (SELECT old_id FROM id_mapping)
    `);
    console.log('  ✅ notifiche_utente aggiornata');
    
    // segnalazioni
    await pool.query(`
      UPDATE segnalazioni 
      SET utente_id = (SELECT new_id FROM id_mapping WHERE old_id = segnalazioni.utente_id),
          risolto_da = (SELECT new_id FROM id_mapping WHERE old_id = segnalazioni.risolto_da)
      WHERE utente_id IN (SELECT old_id FROM id_mapping) OR risolto_da IN (SELECT old_id FROM id_mapping)
    `);
    console.log('  ✅ segnalazioni aggiornata');
    
    // 4. Elimina la tabella utenti
    console.log('🗑️ Eliminazione tabella utenti...');
    await pool.query('DROP TABLE IF EXISTS utenti CASCADE');
    console.log('✅ Tabella utenti eliminata');
    
    // 5. Verifica finale
    const finalCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Record finali in users: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateUtentiToUsers()
  .then(() => {
    console.log('🎉 Migrazione completata con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante la migrazione:', error);
    process.exit(1);
  });
