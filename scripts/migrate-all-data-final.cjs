const { Pool } = require('pg');
const admin = require('firebase-admin');
require('dotenv').config();

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

// Inizializza Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Funzione helper per gestire timestamp
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'string') {
    // Gestisce formati come "24-07-1974"
    if (timestamp.includes('-') && timestamp.split('-').length === 3) {
      const parts = timestamp.split('-');
      if (parts[0].length === 2) {
        // Formato DD-MM-YYYY
        return new Date(parts[2], parts[1] - 1, parts[0]);
      } else if (parts[0].length === 4) {
        // Formato YYYY-MM-DD
        return new Date(timestamp);
      }
    }
    return new Date(timestamp);
  }
  
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  return null;
}

// Funzione helper per gestire boolean
function parseBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'favorevole' || lower === 'si' || lower === 'yes') return true;
    if (lower === 'false' || lower === 'contrario' || lower === 'no') return false;
  }
  if (typeof value === 'number') return value === 1;
  return null;
}

// Funzione helper per gestire integer
function parseInteger(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function migrateAllData() {
  console.log('🚀 Iniziando migrazione completa dei dati...');
  
  try {
    // Test connessione database
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    client.release();
    
    // 1. Migra utenti
    await migrateUtenti();
    
    // 2. Migra comunicazioni
    await migrateComunicazioni();
    
    // 3. Migra opinioni
    await migrateOpinioni();
    
    // 4. Migra opinioni proposte
    await migrateOpinioniProposte();
    
    // 5. Migra voti capo stato
    await migrateVotiCapoStato();
    
    // 6. Migra richieste premium
    await migrateRichiestePremium();
    
    // 7. Migra notifiche admin
    await migrateNotificheAdmin();
    
    // 8. Migra elezioni
    await migrateElezioni();
    
    // 9. Migra iniziative popolari
    await migrateIniziativePopolari();
    
    // 10. Migra voti iniziative popolari
    await migrateVotiIniziativePopolari();
    
    // 11. Migra ICE
    await migrateICE();
    
    // 12. Migra voti ICE
    await migrateVotiICE();
    
    // 13. Migra referendum abrogativi
    await migrateReferendumAbrogativi();
    
    // 14. Migra voti referendum
    await migrateVotiReferendum();
    
    // 15. Migra richieste grazia
    await migrateRichiesteGrazia();
    
    // 16. Migra ministeri
    await migrateMinisteri();
    
    // 17. Migra programmi
    await migrateProgrammi();
    
    // 18. Migra reazioni
    await migrateReazioni();
    
    // 19. Migra notifiche utente
    await migrateNotificheUtente();
    
    // 20. Migra voti amnistia
    await migrateVotiAmnistia();
    
    // 21. Migra voti grazia
    await migrateVotiGrazia();
    
    // 22. Migra voti ministri
    await migrateVotiMinistri();
    
    console.log('🎉 Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

async function migrateUtenti() {
  console.log('👥 Migrando utenti...');
  
  try {
    const snapshot = await db.collection('utenti').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Gestisci campi mancanti
        const utente = {
          id: doc.id,
          email: data.email || null,
          nome: data.nome || null,
          cognome: data.cognome || null,
          data_nascita: parseTimestamp(data.dataNascita || data.data_nascita),
          sesso: data.sesso || null,
          paese: data.paese || null,
          regione: data.regione || null,
          provincia: data.provincia || null,
          comune: data.comune || null,
          indirizzo: data.indirizzo || null,
          telefono: data.telefono || null,
          professione: data.professione || null,
          istruzione: data.istruzione || null,
          reddito: data.reddito || null,
          partito: data.partito || null,
          is_admin: parseBoolean(data.isAdmin || data.is_admin),
          is_premium: parseBoolean(data.isPremium || data.is_premium),
          data_registrazione: parseTimestamp(data.dataRegistrazione || data.data_registrazione),
          ultimo_accesso: parseTimestamp(data.ultimoAccesso || data.ultimo_accesso),
          avatar_url: data.avatarUrl || data.avatar_url || null,
          bio: data.bio || null,
          social_links: data.socialLinks || data.social_links || null,
          preferenze_notifiche: data.preferenzeNotifiche || data.preferenze_notifiche || null,
          paese_candidatura: data.paeseCandidatura || data.paese_candidatura || null,
          regione_candidatura: data.regioneCandidatura || data.regione_candidatura || null,
          provincia_candidatura: data.provinciaCandidatura || data.provincia_candidatura || null,
          comune_candidatura: data.comuneCandidatura || data.comune_candidatura || null,
          candidato_attivo: parseBoolean(data.candidatoAttivo || data.candidato_attivo),
          data_candidatura: parseTimestamp(data.dataCandidatura || data.data_candidatura),
          status_candidatura: data.statusCandidatura || data.status_candidatura || null,
          note_candidatura: data.noteCandidatura || data.note_candidatura || null
        };
        
        await pool.query(`
          INSERT INTO utenti (
            id, email, nome, cognome, data_nascita, sesso, paese, regione, provincia, comune,
            indirizzo, telefono, professione, istruzione, reddito, partito, is_admin, is_premium,
            data_registrazione, ultimo_accesso, avatar_url, bio, social_links, preferenze_notifiche,
            paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
            candidato_attivo, data_candidatura, status_candidatura, note_candidatura
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            nome = EXCLUDED.nome,
            cognome = EXCLUDED.cognome,
            data_nascita = EXCLUDED.data_nascita,
            sesso = EXCLUDED.sesso,
            paese = EXCLUDED.paese,
            regione = EXCLUDED.regione,
            provincia = EXCLUDED.provincia,
            comune = EXCLUDED.comune,
            indirizzo = EXCLUDED.indirizzo,
            telefono = EXCLUDED.telefono,
            professione = EXCLUDED.professione,
            istruzione = EXCLUDED.istruzione,
            reddito = EXCLUDED.reddito,
            partito = EXCLUDED.partito,
            is_admin = EXCLUDED.is_admin,
            is_premium = EXCLUDED.is_premium,
            data_registrazione = EXCLUDED.data_registrazione,
            ultimo_accesso = EXCLUDED.ultimo_accesso,
            avatar_url = EXCLUDED.avatar_url,
            bio = EXCLUDED.bio,
            social_links = EXCLUDED.social_links,
            preferenze_notifiche = EXCLUDED.preferenze_notifiche,
            paese_candidatura = EXCLUDED.paese_candidatura,
            regione_candidatura = EXCLUDED.regione_candidatura,
            provincia_candidatura = EXCLUDED.provincia_candidatura,
            comune_candidatura = EXCLUDED.comune_candidatura,
            candidato_attivo = EXCLUDED.candidato_attivo,
            data_candidatura = EXCLUDED.data_candidatura,
            status_candidatura = EXCLUDED.status_candidatura,
            note_candidatura = EXCLUDED.note_candidatura
          WHERE utenti.id = EXCLUDED.id
        `, Object.values(utente));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato utente ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Utenti: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione utenti:', error);
  }
}

async function migrateOpinioni() {
  console.log('💭 Migrando opinioni...');
  
  try {
    const snapshot = await db.collection('opinioni').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const opinione = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          titolo: data.titolo || null,
          descrizione: data.descrizione || null,
          categoria: data.categoria || null,
          fonte: data.fonte || data.source || 'unknown',
          data_creazione: parseTimestamp(data.dataCreazione || data.data_creazione || data.createdAt),
          data_modifica: parseTimestamp(data.dataModifica || data.data_modifica || data.updatedAt),
          status: data.status || 'attiva',
          tags: data.tags || null,
          immagine_url: data.immagineUrl || data.immagine_url || null,
          fonte_url: data.fonteUrl || data.fonte_url || null,
          autore_fonte: data.autoreFonte || data.autore_fonte || null,
          data_fonte: parseTimestamp(data.dataFonte || data.data_fonte),
          rilevanza: parseInteger(data.rilevanza),
          complessita: parseInteger(data.complessita),
          controversia: parseInteger(data.controversia),
          note_internal: data.noteInternal || data.note_internal || null
        };
        
        await pool.query(`
          INSERT INTO opinioni (
            id, utente_id, titolo, descrizione, categoria, fonte, data_creazione, data_modifica,
            status, tags, immagine_url, fonte_url, autore_fonte, data_fonte, rilevanza, complessita,
            controversia, note_internal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            categoria = EXCLUDED.categoria,
            fonte = EXCLUDED.fonte,
            data_creazione = EXCLUDED.data_creazione,
            data_modifica = EXCLUDED.data_modifica,
            status = EXCLUDED.status,
            tags = EXCLUDED.tags,
            immagine_url = EXCLUDED.immagine_url,
            fonte_url = EXCLUDED.fonte_url,
            autore_fonte = EXCLUDED.autore_fonte,
            data_fonte = EXCLUDED.data_fonte,
            rilevanza = EXCLUDED.rilevanza,
            complessita = EXCLUDED.complessita,
            controversia = EXCLUDED.controversia,
            note_internal = EXCLUDED.note_internal
          WHERE opinioni.id = EXCLUDED.id
        `, Object.values(opinione));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata opinione ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Opinion: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione opinioni:', error);
  }
}

async function migrateIniziativePopolari() {
  console.log('🗳️ Migrando iniziative popolari...');
  
  try {
    const snapshot = await db.collection('iniziative_popolari').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const iniziativa = {
          id: doc.id,
          titolo: data.titolo || null,
          descrizione: data.descrizione || null,
          promotore_id: data.promotoreId || data.promotore_id,
          data_creazione: parseTimestamp(data.dataCreazione || data.data_creazione || data.createdAt),
          data_scadenza: parseTimestamp(data.dataScadenza || data.data_scadenza),
          quorum: parseInteger(data.quorum),
          status: data.status || 'attiva',
          firme_raccolte: parseInteger(data.firmeRaccolte || data.firme_raccolte) || 0,
          firme_necessarie: parseInteger(data.firmeNecessarie || data.firme_necessarie),
          categoria: data.categoria || null,
          tags: data.tags || null,
          documento_url: data.documentoUrl || data.documento_url || null,
          immagine_url: data.immagineUrl || data.immagine_url || null,
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO iniziative_popolari (
            id, titolo, descrizione, promotore_id, data_creazione, data_scadenza, quorum, status,
            firme_raccolte, firme_necessarie, categoria, tags, documento_url, immagine_url, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            promotore_id = EXCLUDED.promotore_id,
            data_creazione = EXCLUDED.data_creazione,
            data_scadenza = EXCLUDED.data_scadenza,
            quorum = EXCLUDED.quorum,
            status = EXCLUDED.status,
            firme_raccolte = EXCLUDED.firme_raccolte,
            firme_necessarie = EXCLUDED.firme_necessarie,
            categoria = EXCLUDED.categoria,
            tags = EXCLUDED.tags,
            documento_url = EXCLUDED.documento_url,
            immagine_url = EXCLUDED.immagine_url,
            note = EXCLUDED.note
          WHERE iniziative_popolari.id = EXCLUDED.id
        `, Object.values(iniziativa));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata iniziativa ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Iniziative popolari: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione iniziative popolari:', error);
  }
}

async function migrateICE() {
  console.log('🌍 Migrando ICE...');
  
  try {
    const snapshot = await db.collection('ice').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const ice = {
          id: doc.id,
          titolo: data.titolo || null,
          descrizione: data.descrizione || null,
          promotore_id: data.promotoreId || data.promotore_id,
          data_creazione: parseTimestamp(data.dataCreazione || data.data_creazione || data.createdAt),
          data_scadenza: parseTimestamp(data.dataScadenza || data.data_scadenza),
          quorum: parseInteger(data.quorum),
          status: data.status || 'attiva',
          firme_raccolte: parseInteger(data.firmeRaccolte || data.firme_raccolte) || 0,
          firme_necessarie: parseInteger(data.firmeNecessarie || data.firme_necessarie),
          categoria: data.categoria || null,
          tags: data.tags || null,
          documento_url: data.documentoUrl || data.documento_url || null,
          immagine_url: data.immagineUrl || data.immagine_url || null,
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO ice (
            id, titolo, descrizione, promotore_id, data_creazione, data_scadenza, quorum, status,
            firme_raccolte, firme_necessarie, categoria, tags, documento_url, immagine_url, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            promotore_id = EXCLUDED.promotore_id,
            data_creazione = EXCLUDED.data_creazione,
            data_scadenza = EXCLUDED.data_scadenza,
            quorum = EXCLUDED.quorum,
            status = EXCLUDED.status,
            firme_raccolte = EXCLUDED.firme_raccolte,
            firme_necessarie = EXCLUDED.firme_necessarie,
            categoria = EXCLUDED.categoria,
            tags = EXCLUDED.tags,
            documento_url = EXCLUDED.documento_url,
            immagine_url = EXCLUDED.immagine_url,
            note = EXCLUDED.note
          WHERE ice.id = EXCLUDED.id
        `, Object.values(ice));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato ICE ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ ICE: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione ICE:', error);
  }
}

// Funzioni di migrazione semplificate per le altre collezioni
async function migrateComunicazioni() {
  console.log('💬 Migrando comunicazioni...');
  
  try {
    const snapshot = await db.collection('comunicazioni').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const comunicazione = {
          id: doc.id,
          mittente_id: data.mittenteId || data.mittente_id,
          destinatario_id: data.destinatarioId || data.destinatario_id,
          oggetto: data.oggetto || null,
          messaggio: data.messaggio || null,
          data_invio: parseTimestamp(data.dataInvio || data.data_invio || data.createdAt),
          data_lettura: parseTimestamp(data.dataLettura || data.data_lettura),
          status: data.status || 'inviato',
          tipo: data.tipo || 'messaggio',
          allegati: data.allegati || null,
          priorita: data.priorita || 'normale'
        };
        
        await pool.query(`
          INSERT INTO comunicazioni (
            id, mittente_id, destinatario_id, oggetto, messaggio, data_invio, data_lettura,
            status, tipo, allegati, priorita
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            mittente_id = EXCLUDED.mittente_id,
            destinatario_id = EXCLUDED.destinatario_id,
            oggetto = EXCLUDED.oggetto,
            messaggio = EXCLUDED.messaggio,
            data_invio = EXCLUDED.data_invio,
            data_lettura = EXCLUDED.data_lettura,
            status = EXCLUDED.status,
            tipo = EXCLUDED.tipo,
            allegati = EXCLUDED.allegati,
            priorita = EXCLUDED.priorita
          WHERE comunicazioni.id = EXCLUDED.id
        `, Object.values(comunicazione));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata comunicazione ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Comunicazioni: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione comunicazioni:', error);
  }
}

async function migrateOpinioniProposte() {
  console.log('📝 Migrando opinioni proposte...');
  
  try {
    const snapshot = await db.collection('opinioni_proposte').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const opinioneProposta = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          titolo: data.titolo || null,
          descrizione: data.descrizione || null,
          categoria: data.categoria || null,
          fonte: data.fonte || data.source || 'unknown',
          data_proposta: parseTimestamp(data.dataProposta || data.data_proposta || data.createdAt),
          status: data.status || 'in_revisione',
          tags: data.tags || null,
          immagine_url: data.immagineUrl || data.immagine_url || null,
          fonte_url: data.fonteUrl || data.fonte_url || null,
          autore_fonte: data.autoreFonte || data.autore_fonte || null,
          data_fonte: parseTimestamp(data.dataFonte || data.data_fonte),
          rilevanza: parseInteger(data.rilevanza),
          complessita: parseInteger(data.complessita),
          controversia: parseInteger(data.controversia),
          note_revisione: data.noteRevisione || data.note_revisione || null,
          revisore_id: data.revisoreId || data.revisore_id || null,
          data_revisione: parseTimestamp(data.dataRevisione || data.data_revisione)
        };
        
        await pool.query(`
          INSERT INTO opinioni_proposte (
            id, utente_id, titolo, descrizione, categoria, fonte, data_proposta, status,
            tags, immagine_url, fonte_url, autore_fonte, data_fonte, rilevanza, complessita,
            controversia, note_revisione, revisore_id, data_revisione
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            categoria = EXCLUDED.categoria,
            fonte = EXCLUDED.fonte,
            data_proposta = EXCLUDED.data_proposta,
            status = EXCLUDED.status,
            tags = EXCLUDED.tags,
            immagine_url = EXCLUDED.immagine_url,
            fonte_url = EXCLUDED.fonte_url,
            autore_fonte = EXCLUDED.autore_fonte,
            data_fonte = EXCLUDED.data_fonte,
            rilevanza = EXCLUDED.rilevanza,
            complessita = EXCLUDED.complessita,
            controversia = EXCLUDED.controversia,
            note_revisione = EXCLUDED.note_revisione,
            revisore_id = EXCLUDED.revisore_id,
            data_revisione = EXCLUDED.data_revisione
          WHERE opinioni_proposte.id = EXCLUDED.id
        `, Object.values(opinioneProposta));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata opinione proposta ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Opinion proposte: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione opinioni proposte:', error);
  }
}

async function migrateVotiCapoStato() {
  console.log('👑 Migrando voti capo stato...');
  
  try {
    const snapshot = await db.collection('voti_capo_stato').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          candidato_id: data.candidatoId || data.candidato_id,
          elezione_id: data.elezioneId || data.elezione_id,
          data_voto: parseTimestamp(data.dataVoto || data.data_voto || data.createdAt),
          voto: parseBoolean(data.voto),
          note: data.note || null,
          ip_address: data.ipAddress || data.ip_address || null,
          user_agent: data.userAgent || data.user_agent || null
        };
        
        await pool.query(`
          INSERT INTO voti_capo_stato (
            id, utente_id, candidato_id, elezione_id, data_voto, voto, note, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            candidato_id = EXCLUDED.candidato_id,
            elezione_id = EXCLUDED.elezione_id,
            data_voto = EXCLUDED.data_voto,
            voto = EXCLUDED.voto,
            note = EXCLUDED.note,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent
          WHERE voti_capo_stato.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto capo stato ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti capo stato: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti capo stato:', error);
  }
}

async function migrateRichiestePremium() {
  console.log('⭐ Migrando richieste premium...');
  
  try {
    const snapshot = await db.collection('richieste_premium').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const richiesta = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          tipo_richiesta: data.tipoRichiesta || data.tipo_richiesta || 'upgrade',
          data_richiesta: parseTimestamp(data.dataRichiesta || data.data_richiesta || data.createdAt),
          status: data.status || 'in_attesa',
          motivazione: data.motivazione || null,
          documenti_url: data.documentiUrl || data.documenti_url || null,
          note_admin: data.noteAdmin || data.note_admin || null,
          data_approvazione: parseTimestamp(data.dataApprovazione || data.data_approvazione),
          approvatore_id: data.approvatoreId || data.approvatore_id || null
        };
        
        await pool.query(`
          INSERT INTO richieste_premium (
            id, utente_id, tipo_richiesta, data_richiesta, status, motivazione,
            documenti_url, note_admin, data_approvazione, approvatore_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            tipo_richiesta = EXCLUDED.tipo_richiesta,
            data_richiesta = EXCLUDED.data_richiesta,
            status = EXCLUDED.status,
            motivazione = EXCLUDED.motivazione,
            documenti_url = EXCLUDED.documenti_url,
            note_admin = EXCLUDED.note_admin,
            data_approvazione = EXCLUDED.data_approvazione,
            approvatore_id = EXCLUDED.approvatore_id
          WHERE richieste_premium.id = EXCLUDED.id
        `, Object.values(richiesta));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata richiesta premium ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Richieste premium: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione richieste premium:', error);
  }
}

async function migrateNotificheAdmin() {
  console.log('🔔 Migrando notifiche admin...');
  
  try {
    const snapshot = await db.collection('admin_notifications').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const notifica = {
          id: doc.id,
          tipo: data.tipo || 'generica',
          titolo: data.titolo || null,
          messaggio: data.messaggio || null,
          destinatario_id: data.destinatarioId || data.destinatario_id,
          data_creazione: parseTimestamp(data.createdAt || data.dataCreazione || data.data_creazione),
          data_lettura: parseTimestamp(data.dataLettura || data.data_lettura),
          status: data.status || 'non_letta',
          priorita: data.priorita || 'normale',
          azioni: data.azioni || null,
          metadata: data.metadata || null
        };
        
        await pool.query(`
          INSERT INTO admin_notifications (
            id, tipo, titolo, messaggio, destinatario_id, data_creazione, data_lettura,
            status, priorita, azioni, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            tipo = EXCLUDED.tipo,
            titolo = EXCLUDED.titolo,
            messaggio = EXCLUDED.messaggio,
            destinatario_id = EXCLUDED.destinatario_id,
            data_creazione = EXCLUDED.data_creazione,
            data_lettura = EXCLUDED.data_lettura,
            status = EXCLUDED.status,
            priorita = EXCLUDED.priorita,
            azioni = EXCLUDED.azioni,
            metadata = EXCLUDED.metadata
          WHERE admin_notifications.id = EXCLUDED.id
        `, Object.values(notifica));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata notifica admin ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Notifiche admin: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione notifiche admin:', error);
  }
}

async function migrateElezioni() {
  console.log('🗳️ Migrando elezioni...');
  
  try {
    const snapshot = await db.collection('elezioni').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const elezione = {
          id: doc.id,
          titolo: data.titolo || null,
          descrizione: data.descrizione || null,
          tipo: data.tipo || 'generale',
          data_inizio: parseTimestamp(data.dataInizio || data.data_inizio),
          data_fine: parseTimestamp(data.dataFine || data.data_fine),
          status: data.status || 'attiva',
          quorum: parseInteger(data.quorum),
          candidati: data.candidati || null,
          regole: data.regole || null,
          risultati: data.risultati || null,
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO elezioni (
            id, titolo, descrizione, tipo, data_inizio, data_fine, status, quorum,
            candidati, regole, risultati, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            tipo = EXCLUDED.tipo,
            data_inizio = EXCLUDED.data_inizio,
            data_fine = EXCLUDED.data_fine,
            status = EXCLUDED.status,
            quorum = EXCLUDED.quorum,
            candidati = EXCLUDED.candidati,
            regole = EXCLUDED.regole,
            risultati = EXCLUDED.risultati,
            note = EXCLUDED.note
          WHERE elezioni.id = EXCLUDED.id
        `, Object.values(elezione));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata elezione ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Elezioni: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione elezioni:', error);
  }
}

async function migrateVotiIniziativePopolari() {
  console.log('✅ Migrando voti iniziative popolari...');
  
  try {
    const snapshot = await db.collection('voti_iniziative_popolari').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          iniziativa_id: data.iniziativaId || data.iniziativa_id,
          data_voto: parseTimestamp(data.dataVoto || data.data_voto || data.createdAt),
          voto: parseBoolean(data.voto),
          note: data.note || null,
          ip_address: data.ipAddress || data.ip_address || null,
          user_agent: data.userAgent || data.user_agent || null
        };
        
        await pool.query(`
          INSERT INTO voti_iniziative_popolari (
            id, utente_id, iniziativa_id, data_voto, voto, note, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            iniziativa_id = EXCLUDED.iniziativa_id,
            data_voto = EXCLUDED.data_voto,
            voto = EXCLUDED.voto,
            note = EXCLUDED.note,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent
          WHERE voti_iniziative_popolari.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto iniziativa popolare ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti iniziative popolari: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti iniziative popolari:', error);
  }
}

async function migrateVotiICE() {
  console.log('✅ Migrando voti ICE...');
  
  try {
    const snapshot = await db.collection('voti_ice').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          ice_id: data.iceId || data.ice_id,
          data_voto: parseTimestamp(data.dataVoto || data.data_voto || data.createdAt),
          voto: parseBoolean(data.voto),
          note: data.note || null,
          ip_address: data.ipAddress || data.ip_address || null,
          user_agent: data.userAgent || data.user_agent || null
        };
        
        await pool.query(`
          INSERT INTO voti_ice (
            id, utente_id, ice_id, data_voto, voto, note, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            ice_id = EXCLUDED.ice_id,
            data_voto = EXCLUDED.data_voto,
            voto = EXCLUDED.voto,
            note = EXCLUDED.note,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent
          WHERE voti_ice.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto ICE ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti ICE: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti ICE:', error);
  }
}

async function migrateReferendumAbrogativi() {
  console.log('🗳️ Migrando referendum abrogativi...');
  
  try {
    const snapshot = await db.collection('referendum_abrogativi').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const referendum = {
          id: doc.id,
          titolo: data.titolo || null,
          descrizione: data.descrizione || null,
          promotore_id: data.promotoreId || data.promotore_id,
          data_creazione: parseTimestamp(data.dataCreazione || data.data_creazione || data.createdAt),
          data_scadenza: parseTimestamp(data.dataScadenza || data.data_scadenza),
          quorum: parseInteger(data.quorum),
          status: data.status || 'attiva',
          firme_raccolte: parseInteger(data.firmeRaccolte || data.firme_raccolte) || 0,
          firme_necessarie: parseInteger(data.firmeNecessarie || data.firme_necessarie),
          categoria: data.categoria || null,
          tags: data.tags || null,
          documento_url: data.documentoUrl || data.documento_url || null,
          immagine_url: data.immagineUrl || data.immagine_url || null,
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO referendum_abrogativi (
            id, titolo, descrizione, promotore_id, data_creazione, data_scadenza, quorum, status,
            firme_raccolte, firme_necessarie, categoria, tags, documento_url, immagine_url, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            promotore_id = EXCLUDED.promotore_id,
            data_creazione = EXCLUDED.data_creazione,
            data_scadenza = EXCLUDED.data_scadenza,
            quorum = EXCLUDED.quorum,
            status = EXCLUDED.status,
            firme_raccolte = EXCLUDED.firme_raccolte,
            firme_necessarie = EXCLUDED.firme_necessarie,
            categoria = EXCLUDED.categoria,
            tags = EXCLUDED.tags,
            documento_url = EXCLUDED.documento_url,
            immagine_url = EXCLUDED.immagine_url,
            note = EXCLUDED.note
          WHERE referendum_abrogativi.id = EXCLUDED.id
        `, Object.values(referendum));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato referendum ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Referendum abrogativi: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione referendum abrogativi:', error);
  }
}

async function migrateVotiReferendum() {
  console.log('✅ Migrando voti referendum...');
  
  try {
    const snapshot = await db.collection('voti_referendum_abrogativi').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.utenteId || data.utente_id,
          referendum_id: data.referendumId || data.referendum_id,
          data_voto: parseTimestamp(data.dataVoto || data.data_voto || data.createdAt),
          voto: parseBoolean(data.voto),
          note: data.note || null,
          ip_address: data.ipAddress || data.ip_address || null,
          user_agent: data.userAgent || data.user_agent || null
        };
        
        await pool.query(`
          INSERT INTO voti_referendum_abrogativi (
            id, utente_id, referendum_id, data_voto, voto, note, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            referendum_id = EXCLUDED.referendum_id,
            data_voto = EXCLUDED.data_voto,
            voto = EXCLUDED.voto,
            note = EXCLUDED.note,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent
          WHERE voti_referendum_abrogativi.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto referendum ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti referendum: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti referendum:', error);
  }
}

// Nuove funzioni di migrazione per le collezioni aggiuntive
async function migrateRichiesteGrazia() {
  console.log('🙏 Migrando richieste grazia...');
  
  try {
    const snapshot = await db.collection('grazia_requests').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const richiesta = {
          id: doc.id,
          utente_id: data.userId || data.utente_id,
          nome: data.nome || null,
          url_prova: data.urlProva || data.url_prova || null,
          status: data.status || 'pending',
          data_creazione: parseTimestamp(data.createdAt || data.data_creazione),
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO richieste_grazia (
            id, utente_id, nome, url_prova, status, data_creazione, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            nome = EXCLUDED.nome,
            url_prova = EXCLUDED.url_prova,
            status = EXCLUDED.status,
            data_creazione = EXCLUDED.data_creazione,
            note = EXCLUDED.note
          WHERE richieste_grazia.id = EXCLUDED.id
        `, Object.values(richiesta));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata richiesta grazia ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Richieste grazia: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione richieste grazia:', error);
  }
}

async function migrateMinisteri() {
  console.log('🏛️ Migrando ministeri...');
  
  try {
    const snapshot = await db.collection('ministeri').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const ministero = {
          id: doc.id,
          nome: data.nome || null,
          categoria: data.categoria || null,
          descrizione: data.descrizione || null,
          abilitato: parseBoolean(data.abilitato),
          data_creazione: new Date(),
          data_modifica: new Date()
        };
        
        await pool.query(`
          INSERT INTO ministeri (
            id, nome, categoria, descrizione, abilitato, data_creazione, data_modifica
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            categoria = EXCLUDED.categoria,
            descrizione = EXCLUDED.descrizione,
            abilitato = EXCLUDED.abilitato,
            data_modifica = EXCLUDED.data_modifica
          WHERE ministeri.id = EXCLUDED.id
        `, Object.values(ministero));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato ministero ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Ministeri: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione ministeri:', error);
  }
}

async function migrateProgrammi() {
  console.log('📋 Migrando programmi...');
  
  try {
    const snapshot = await db.collection('programmi').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const programma = {
          id: doc.id,
          utente_id: data.userId || data.utente_id,
          proposta_1: data.proposta1 || data.proposta_1 || null,
          proposta_2: data.proposta2 || data.proposta_2 || null,
          proposta_3: data.proposta3 || data.proposta_3 || null,
          proposta_4: data.proposta4 || data.proposta_4 || null,
          proposta_5: data.proposta5 || data.proposta_5 || null,
          data_creazione: new Date(),
          data_modifica: new Date()
        };
        
        await pool.query(`
          INSERT INTO programmi (
            id, utente_id, proposta_1, proposta_2, proposta_3, proposta_4, proposta_5,
            data_creazione, data_modifica
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            proposta_1 = EXCLUDED.proposta_1,
            proposta_2 = EXCLUDED.proposta_2,
            proposta_3 = EXCLUDED.proposta_3,
            proposta_4 = EXCLUDED.proposta_4,
            proposta_5 = EXCLUDED.proposta_5,
            data_modifica = EXCLUDED.data_modifica
          WHERE programmi.id = EXCLUDED.id
        `, Object.values(programma));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato programma ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Programmi: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione programmi:', error);
  }
}

async function migrateReazioni() {
  console.log('👍 Migrando reazioni...');
  
  try {
    const snapshot = await db.collection('reazioni').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const reazione = {
          id: doc.id,
          comunicazione_id: data.comunicazione_id,
          utente_id: data.utente_id,
          tipo: data.tipo || 'like',
          data_creazione: parseTimestamp(data.data_creazione),
          data_aggiornamento: parseTimestamp(data.data_aggiornamento)
        };
        
        await pool.query(`
          INSERT INTO reazioni (
            id, comunicazione_id, utente_id, tipo, data_creazione, data_aggiornamento
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            comunicazione_id = EXCLUDED.comunicazione_id,
            utente_id = EXCLUDED.utente_id,
            tipo = EXCLUDED.tipo,
            data_creazione = EXCLUDED.data_creazione,
            data_aggiornamento = EXCLUDED.data_aggiornamento
          WHERE reazioni.id = EXCLUDED.id
        `, Object.values(reazione));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata reazione ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Reazioni: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione reazioni:', error);
  }
}

async function migrateNotificheUtente() {
  console.log('🔔 Migrando notifiche utente...');
  
  try {
    const snapshot = await db.collection('user_notifications').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const notifica = {
          id: doc.id,
          utente_id: data.user_id || data.utente_id,
          tipo: data.type || 'generica',
          titolo: data.title || null,
          messaggio: data.message || null,
          data_creazione: parseTimestamp(data.created_at || data.data_creazione),
          data_lettura: null,
          status: 'non_letta',
          priorita: 'normale'
        };
        
        await pool.query(`
          INSERT INTO notifiche_utente (
            id, utente_id, tipo, titolo, messaggio, data_creazione, data_lettura, status, priorita
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            tipo = EXCLUDED.tipo,
            titolo = EXCLUDED.titolo,
            messaggio = EXCLUDED.messaggio,
            data_creazione = EXCLUDED.data_creazione,
            data_lettura = EXCLUDED.data_lettura,
            status = EXCLUDED.status,
            priorita = EXCLUDED.priorita
          WHERE notifiche_utente.id = EXCLUDED.id
        `, Object.values(notifica));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltata notifica utente ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Notifiche utente: ${migrated} migrate, ${skipped} saltate`);
    
  } catch (error) {
    console.error('❌ Errore migrazione notifiche utente:', error);
  }
}

async function migrateVotiAmnistia() {
  console.log('📜 Migrando voti amnistia...');
  
  try {
    const snapshot = await db.collection('voti_amnistia').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.userId || data.utente_id,
          legge: data.legge || null,
          data_voto: parseTimestamp(data.timestamp),
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO voti_amnistia (
            id, utente_id, legge, data_voto, note
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            legge = EXCLUDED.legge,
            data_voto = EXCLUDED.data_voto,
            note = EXCLUDED.note
          WHERE voti_amnistia.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto amnistia ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti amnistia: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti amnistia:', error);
  }
}

async function migrateVotiGrazia() {
  console.log('🙏 Migrando voti grazia...');
  
  try {
    const snapshot = await db.collection('voti_grazia').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.userId || data.utente_id,
          nome: data.nome || null,
          data_voto: parseTimestamp(data.timestamp),
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO voti_grazia (
            id, utente_id, nome, data_voto, note
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            nome = EXCLUDED.nome,
            data_voto = EXCLUDED.data_voto,
            note = EXCLUDED.note
          WHERE voti_grazia.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto grazia ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti grazia: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti grazia:', error);
  }
}

async function migrateVotiMinistri() {
  console.log('👔 Migrando voti ministri...');
  
  try {
    const snapshot = await db.collection('voti_ministri').get();
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        const voto = {
          id: doc.id,
          utente_id: data.userId || data.utente_id,
          categoria: data.categoria || null,
          nome_ministro: data.nomeMinistro || data.nome_ministro || null,
          nome_display: data.nomeDisplay || data.nome_display || null,
          data_voto: parseTimestamp(data.timestamp),
          note: data.note || null
        };
        
        await pool.query(`
          INSERT INTO voti_ministri (
            id, utente_id, categoria, nome_ministro, nome_display, data_voto, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            utente_id = EXCLUDED.utente_id,
            categoria = EXCLUDED.categoria,
            nome_ministro = EXCLUDED.nome_ministro,
            nome_display = EXCLUDED.nome_display,
            data_voto = EXCLUDED.data_voto,
            note = EXCLUDED.note
          WHERE voti_ministri.id = EXCLUDED.id
        `, Object.values(voto));
        
        migrated++;
      } catch (error) {
        console.log(`⚠️ Saltato voto ministro ${doc.id}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`✅ Voti ministri: ${migrated} migrati, ${skipped} saltati`);
    
  } catch (error) {
    console.error('❌ Errore migrazione voti ministri:', error);
  }
}

// Esegui la migrazione
migrateAllData();
