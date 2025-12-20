const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Funzione per creare record in notifiche_utente per tutti gli utenti attivi
async function createNotificheUtente(comunicazioneId) {
  try {
    console.log('📝 Creazione record notifiche_utente per comunicazione:', comunicazioneId);
    
    // Trova tutti gli utenti attivi
    const utenti = await pool.query('SELECT id FROM users WHERE status = $1 OR status = $2', ['A', 'a']);
    
    // Crea un record per ogni utente
    for (const utente of utenti.rows) {
      await pool.query(`
        INSERT INTO notifiche_utente (utente_id, comunicazione_id, status)
        VALUES ($1, $2, 'non_letta')
        ON CONFLICT (utente_id, comunicazione_id) DO NOTHING
      `, [utente.id, comunicazioneId]);
    }
    
    console.log(`✅ Creati record notifiche_utente per ${utenti.rows.length} utenti`);
  } catch (error) {
    console.error('❌ Errore nella creazione record notifiche_utente:', error);
  }
}

// Funzione per aggiornare record in notifiche_utente (reset status a non_letta)
async function updateNotificheUtente(comunicazioneId) {
  try {
    console.log('🔄 Aggiornamento record notifiche_utente per comunicazione:', comunicazioneId);
    
    // Reset tutti i record esistenti a 'non_letta'
    await pool.query(`
      UPDATE notifiche_utente 
      SET status = 'non_letta', data_lettura = NULL
      WHERE comunicazione_id = $1
    `, [comunicazioneId]);
    
    // Crea record per nuovi utenti attivi che non hanno ancora il record
    const utenti = await pool.query(`
      SELECT u.id 
      FROM users u 
      WHERE (u.status = 'A' OR u.status = 'a') 
      AND NOT EXISTS (
        SELECT 1 FROM notifiche_utente nu 
        WHERE nu.utente_id = u.id AND nu.comunicazione_id = $1
      )
    `, [comunicazioneId]);
    
    for (const utente of utenti.rows) {
      await pool.query(`
        INSERT INTO notifiche_utente (utente_id, comunicazione_id, status)
        VALUES ($1, $2, 'non_letta')
      `, [utente.id, comunicazioneId]);
    }
    
    console.log(`✅ Aggiornati record notifiche_utente per comunicazione ${comunicazioneId}`);
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento record notifiche_utente:', error);
  }
}

// ===== ENDPOINTS PER COMUNICAZIONI =====

// GET /api/comunicazioni - Lista comunicazioni
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero comunicazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/comunicazioni - Crea o aggiorna comunicazione
router.post('/', async (req, res) => {
  try {
    const {
      titolo,
      voto_dato,
      commento,
      vincitore,
      zona,
      id_utente,
      tipo = 'votazione',
      voti, // Array di voti per "Comunica Voti"
      tipologia, // Per "Informa Cittadini"
      dove, // Per "Informa Cittadini"
      dal_giorno, // Per "Informa Cittadini"
      al_giorno // Per "Informa Cittadini"
    } = req.body;

    // Validazione: per "informa_cittadini" il titolo non è obbligatorio
    if (tipo !== 'informa_cittadini' && (!titolo || !id_utente)) {
      return res.status(400).json({
        success: false,
        error: 'Titolo e ID utente sono obbligatori'
      });
    }

    // Validazione per "informa_cittadini"
    if (tipo === 'informa_cittadini' && (!id_utente || !tipologia || !dove || !dal_giorno || !al_giorno)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente, tipologia, dove, dal_giorno e al_giorno sono obbligatori per Informa Cittadini'
      });
    }

    // Se ci sono voti multipli (Comunica Voti), gestisci ogni voto
    if (voti && Array.isArray(voti) && voti.length > 0) {
      const comunicazioni = [];

      for (const voto of voti) {
        if (!voto.nome || !voto.voto) continue;

        // Cerca l'utente Politico/Candidato Politico per nome
        const utenteResult = await pool.query(
          `SELECT id, nome, cognome, ruolo FROM users 
           WHERE (nome ILIKE $1 OR cognome ILIKE $1 OR CONCAT(nome, ' ', cognome) ILIKE $1)
           AND ruolo IN ('P', 'CP')
           LIMIT 1`,
          [`%${voto.nome}%`]
        );

        if (utenteResult.rows.length === 0) {
          console.log(`⚠️ Utente non trovato per: ${voto.nome}`);
          continue;
        }

        const utentePolitico = utenteResult.rows[0];
        const testo = `Il voto di ${utentePolitico.nome} ${utentePolitico.cognome}: ${voto.voto}`;
        const titoloCompleto = `${titolo} - ${utentePolitico.nome} ${utentePolitico.cognome}`;

        // Controlla se esiste già una comunicazione per questo utente politico
        const existingComunicazione = await pool.query(
          'SELECT id FROM comunicazioni WHERE id_utente = $1 AND tipo = $2 ORDER BY data_creazione DESC LIMIT 1',
          [utentePolitico.id, 'comunica_voti']
        );

        if (existingComunicazione.rows.length > 0) {
          // Aggiorna comunicazione esistente
          const comunicazioneId = existingComunicazione.rows[0].id;
          
          // Reset like/dislike
          await pool.query(
            'DELETE FROM reazioni WHERE comunicazione_id = $1',
            [comunicazioneId]
          );

          const result = await pool.query(
            `UPDATE comunicazioni SET 
              titolo = $1, 
              testo = $2, 
              voto_dato = $3, 
              vincitore = $4, 
              commento = $5,
              data_creazione = NOW(),
              likes = 0,
              dislikes = 0
            WHERE id = $6 
            RETURNING *`,
            [titoloCompleto, testo, voto.voto, vincitore, commento || '', comunicazioneId]
          );

          comunicazioni.push(result.rows[0]);

          // Invia notifica ai sostenitori
          await notifySostenitori(utentePolitico.id, titoloCompleto, result.rows[0]);
        } else {
          // Crea nuova comunicazione
          const result = await pool.query(
            `INSERT INTO comunicazioni (
              id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
              data_creazione, likes, dislikes, punti_trasparenza, tipo
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3, $8
            ) RETURNING *`,
            [utentePolitico.id, titoloCompleto, testo, zona || 'Generale', voto.voto, vincitore, commento || '', 'comunica_voti']
          );

          comunicazioni.push(result.rows[0]);

          // Invia notifica ai sostenitori
          await notifySostenitori(utentePolitico.id, titoloCompleto, result.rows[0]);
        }
      }

      return res.status(201).json({
        success: true,
        data: comunicazioni,
        message: `${comunicazioni.length} voti salvati con successo`
      });
    }

    // Gestione speciale per "Informa Cittadini"
    if (tipo === 'informa_cittadini') {
      const titoloComunicazione = `${tipologia} - ${dove}`;
      const testo = `Tipologia: ${tipologia}\nDove: ${dove}\nDal: ${dal_giorno}\nAl: ${al_giorno}`;
      
      // Crea nuova comunicazione per "Informa Cittadini"
      const result = await pool.query(
        `INSERT INTO comunicazioni (
          id, id_utente, titolo, testo, zona, tipologia, dove, dal_giorno, al_giorno,
          data_creazione, likes, dislikes, punti_trasparenza, tipo, status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), 0, 0, 3, $9, 'non_letta'
        ) RETURNING *`,
        [id_utente, titoloComunicazione, testo, zona || 'Generale', tipologia, dove, dal_giorno, al_giorno, tipo]
      );

      // Crea record in notifiche_utente per tutti gli utenti attivi
      await createNotificheUtente(result.rows[0].id);

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Comunicazione "Informa Cittadini" creata con successo'
      });
    }

    // Gestione speciale per notifiche di Demos
    if (tipo === 'demos_notification') {
      const testo = `Notifica Demos: ${commento || ''}`;
      
      // Controlla se esiste già una notifica Demos e la sovrascrivi
      const existingDemosNotification = await pool.query(
        'SELECT id FROM comunicazioni WHERE tipo = $1 ORDER BY data_creazione DESC LIMIT 1',
        ['demos_notification']
      );

      let result;
      if (existingDemosNotification.rows.length > 0) {
        // Aggiorna notifica esistente
        const comunicazioneId = existingDemosNotification.rows[0].id;
        
        // Reset like/dislike
        await pool.query(
          'DELETE FROM reazioni WHERE comunicazione_id = $1',
          [comunicazioneId]
        );

        result = await pool.query(
          `UPDATE comunicazioni SET
            id_utente = $1,
            titolo = $2,
            testo = $3,
            zona = $4,
            commento = $5,
            data_creazione = NOW(),
            likes = 0,
            dislikes = 0,
            punti_trasparenza = 0
          WHERE id = $6
          RETURNING *`,
          [id_utente, titolo, testo, zona || 'Generale', commento || '', comunicazioneId]
        );
      } else {
        // Crea nuova notifica Demos
        result = await pool.query(
          `INSERT INTO comunicazioni (
            id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
            data_creazione, likes, dislikes, punti_trasparenza, tipo
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 0, $8
          ) RETURNING *`,
          [id_utente, titolo, testo, zona || 'Generale', null, null, commento || '', tipo]
        );
      }

      // Invia notifica a TUTTI gli utenti
      await notifyAllUsers(titolo, commento || '');

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Notifica Demos inviata a tutti gli utenti'
      });
    }

    // Per "Nuova Comunicazione Votazione", controlla se esiste già una comunicazione per questo utente
    const existingComunicazione = await pool.query(
      'SELECT id FROM comunicazioni WHERE id_utente = $1 AND tipo = $2 ORDER BY data_creazione DESC LIMIT 1',
      [id_utente, tipo]
    );

    const testo = `Voto: ${voto_dato || 'Non specificato'}${commento ? ` - Commento: ${commento}` : ''}`;

    if (existingComunicazione.rows.length > 0) {
      // Aggiorna comunicazione esistente
      const comunicazioneId = existingComunicazione.rows[0].id;
      
      // Reset like/dislike
      await pool.query(
        'DELETE FROM reazioni WHERE comunicazione_id = $1',
        [comunicazioneId]
      );

      const result = await pool.query(
        `UPDATE comunicazioni SET 
          titolo = $1, 
          testo = $2, 
          voto_dato = $3, 
          vincitore = $4, 
          commento = $5,
          data_creazione = NOW(),
          likes = 0,
          dislikes = 0,
          status = 'non_letta'
        WHERE id = $6 
        RETURNING *`,
        [titolo, testo, voto_dato, vincitore, commento || '', comunicazioneId]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      // Aggiorna i record in notifiche_utente per tutti gli utenti attivi
      await updateNotificheUtente(comunicazioneId);

      res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'Comunicazione aggiornata con successo'
      });
    } else {
      // Crea nuova comunicazione
      const result = await pool.query(
        `INSERT INTO comunicazioni (
          id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
          data_creazione, likes, dislikes, punti_trasparenza, tipo, status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3, $8, 'non_letta'
        ) RETURNING *`,
        [id_utente, titolo, testo, zona || 'Generale', voto_dato, vincitore, commento || '', tipo]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      // Crea record in notifiche_utente per tutti gli utenti attivi
      await createNotificheUtente(result.rows[0].id);

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }
  } catch (error) {
    console.error('❌ Errore nella creazione/aggiornamento comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Funzione per notificare i sostenitori
async function notifySostenitori(utenteId, titolo, comunicazione) {
  try {
    // Recupera i sostenitori dell'utente
    const sostenitoriResult = await pool.query(
      'SELECT utente_id FROM sostenitori WHERE sostenuto_id = $1',
      [utenteId]
    );

    if (sostenitoriResult.rows.length === 0) return;

    // Crea notifiche per ogni sostenitore
    const notifiche = sostenitoriResult.rows.map(sostenitore => ({
      utente_id: sostenitore.utente_id,
      titolo: `Nuova comunicazione da ${comunicazione.titolo}`,
      messaggio: `Il tuo sostenuto ha pubblicato una nuova comunicazione: "${titolo}"`,
      tipo: 'comunicazione_aggiornata',
      priorita: 'media'
    }));

    // Inserisci le notifiche
    for (const notifica of notifiche) {
      await pool.query(
        `INSERT INTO notifiche_utente (id, utente_id, titolo, messaggio, tipo, priorita, data_creazione)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [notifica.utente_id, notifica.titolo, notifica.messaggio, notifica.tipo, notifica.priorita]
      );
    }

    console.log(`✅ Notifiche inviate a ${sostenitoriResult.rows.length} sostenitori`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche ai sostenitori:', error);
  }
}

// Funzione helper per inviare push notification usando Firebase Admin SDK
async function sendPushNotification(fcmToken, title, body, data = {}) {
  try {
    if (!fcmToken || !fcmToken.trim()) {
      return { success: false, error: 'Token FCM non valido' };
    }

    // Inizializza Firebase Admin se non già fatto
    const { getFirebaseAdmin } = require('../services/firebaseAdmin');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.warn('⚠️ Firebase Admin non disponibile. Notifica push non inviata.');
      return { success: false, error: 'Firebase Admin non configurato' };
    }

    // Prepara il messaggio FCM
    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Per compatibilità mobile
        type: data.type || 'demos_notification'
      },
      webpush: {
        headers: {
          'Urgency': 'high'
        },
        notification: {
          icon: '/icona.png',
          badge: '/icona.png',
          tag: 'demos-notification',
          requireInteraction: true,
          data: {
            url: data.url || '/comunica',
            link: data.link || 'https://www.demos.community/comunica'
          },
          actions: [
            {
              action: 'open',
              title: 'Apri'
            },
            {
              action: 'close',
              title: 'Chiudi'
            }
          ]
        },
        fcmOptions: {
          link: data.link || data.url || 'https://www.demos.community/comunica'
        }
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'demos_notifications'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Invia la notifica push
    const response = await admin.messaging().send(message);
    console.log(`✅ Push notification inviata con successo. Message ID: ${response}`);
    
    return { success: true, messageId: response };
  } catch (error) {
    // Gestisci errori specifici di FCM
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.warn(`⚠️ Token FCM non valido o non registrato: ${fcmToken?.substring(0, 20)}...`);
      return { success: false, error: 'Token non valido', shouldRemoveToken: true };
    }
    
    console.error('❌ Errore invio push notification:', error.message);
    console.error('❌ Error code:', error.code);
    return { success: false, error: error.message, code: error.code };
  }
}

// Funzione per notificare tutti gli utenti (per notifiche Demos)
async function notifyAllUsers(titolo, commento) {
  try {
    // Crea UNA comunicazione nella tabella comunicazioni con tipo 'demos_notification'
    // Questa sarà visibile a tutti gli utenti e il badge la mostrerà come non letta
    // Usa gen_random_uuid() per compatibilità con UUID o VARCHAR
    let comunicazioneId;
    
    // Verifica se esiste il campo read_by, altrimenti lo crea
    try {
      const checkColumns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' 
        AND column_name IN ('read_by', 'tipo', 'id')
      `);
      
      const hasReadBy = checkColumns.rows.some(r => r.column_name === 'read_by');
      const hasTipo = checkColumns.rows.some(r => r.column_name === 'tipo');
      const idType = checkColumns.rows.find(r => r.column_name === 'id')?.data_type || 'uuid';
      
      // Aggiungi read_by se non esiste (può essere UUID[] o VARCHAR[])
      if (!hasReadBy) {
        const readByType = idType === 'uuid' ? 'UUID[]' : 'VARCHAR[]';
        await pool.query(`
          ALTER TABLE comunicazioni ADD COLUMN read_by ${readByType} DEFAULT ARRAY[]::${readByType}
        `);
        console.log(`✅ Aggiunta colonna read_by (${readByType})`);
      }
      
      // Aggiungi tipo se non esiste
      if (!hasTipo) {
        await pool.query(`
          ALTER TABLE comunicazioni ADD COLUMN tipo VARCHAR(50) DEFAULT 'votazione'
        `);
        console.log('✅ Aggiunta colonna tipo');
      }
    } catch (alterError) {
      console.warn('⚠️ Errore nel verificare/creare colonne:', alterError.message);
    }

    // Crea la comunicazione nella tabella comunicazioni
    // Usa gen_random_uuid() per compatibilità
    // Inizializza read_by come array vuoto per assicurarsi che sia non letta per tutti
    console.log('📝 Creazione comunicazione Demos...');
    const comunicazioneResult = await pool.query(`
      INSERT INTO comunicazioni (
        id, id_utente, titolo, testo, zona, tipo, 
        data_creazione, likes, dislikes, punti_trasparenza, 
        read_by, status
      ) VALUES (
        gen_random_uuid(), NULL, $1, $2, 'Generale', 'demos_notification',
        NOW(), 0, 0, 0, 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'comunicazioni' 
            AND column_name = 'read_by' 
            AND data_type = 'ARRAY'
            AND udt_name LIKE '%uuid%'
          ) THEN ARRAY[]::UUID[]
          ELSE ARRAY[]::VARCHAR[]
        END,
        'non_letta'
      ) RETURNING id, read_by
    `, [
      `Notifica Demos: ${titolo}`,
      commento || titolo
    ]);

    comunicazioneId = comunicazioneResult.rows[0].id;
    console.log(`✅ Comunicazione Demos creata con ID: ${comunicazioneId}`);
    console.log(`📋 read_by inizializzato: ${JSON.stringify(comunicazioneResult.rows[0].read_by)}`);

    // Recupera solo gli utenti che hanno attivato "Notifiche Demos" e hanno FCM tokens
    // SOLO gli utenti con demos: true (non NULL o undefined)
    const utentiConPushResult = await pool.query(`
      SELECT id, fcm_tokens, notifiche_preferenze, email, nome, cognome
      FROM users 
      WHERE (status = $1 OR status IS NULL)
        AND notifiche_preferenze->>'demos' = 'true'
        AND fcm_tokens IS NOT NULL 
        AND array_length(fcm_tokens, 1) > 0
    `, ['active']);

    console.log(`🔍 Utenti trovati con demos: true e FCM tokens: ${utentiConPushResult.rows.length}`);
    
    if (utentiConPushResult.rows.length === 0) {
      console.log('ℹ️ Nessun utente con push notifications attive per Demos');
      console.log('💡 Verifica che gli utenti abbiano:');
      console.log('   1. notifiche_preferenze->>\'demos\' = \'true\'');
      console.log('   2. fcm_tokens non vuoto');
      return;
    }

    // Invia push notifications solo agli utenti con preferenza attiva
    const pushTitle = `Notifica Demos: ${titolo}`;
    const pushBody = commento || titolo;
    let pushSuccessCount = 0;
    let pushFailureCount = 0;

    const invalidTokens = []; // Raccogli token non validi da rimuovere
    
    console.log(`📤 Invio push notifications a ${utentiConPushResult.rows.length} utenti...`);
    
    for (const utente of utentiConPushResult.rows) {
      const fcmTokens = utente.fcm_tokens || [];
      const validTokens = [];
      
      console.log(`  📱 Utente ${utente.email || utente.id}: ${fcmTokens.length} token(s) FCM`);
      
      // Invia push notification a tutti i token FCM dell'utente
      for (const token of fcmTokens) {
        if (token && token.trim()) {
          console.log(`    🔔 Invio notifica push a token: ${token.substring(0, 20)}...`);
          
          const result = await sendPushNotification(
            token,
            pushTitle,
            pushBody,
            {
              type: 'demos_notification',
              titolo: titolo,
              messaggio: commento,
              url: '/comunica',
              link: 'https://www.demos.community/comunica'
            }
          );
          
          if (result.success) {
            pushSuccessCount++;
            validTokens.push(token); // Mantieni solo i token validi
            console.log(`    ✅ Notifica inviata con successo`);
          } else {
            pushFailureCount++;
            console.log(`    ❌ Errore invio notifica: ${result.error}`);
            // Se il token non è valido, segnalo per rimozione
            if (result.shouldRemoveToken) {
              invalidTokens.push({ userId: utente.id, token });
              console.log(`    🗑️ Token marcato per rimozione`);
            } else {
              validTokens.push(token); // Mantieni il token se l'errore è temporaneo
            }
          }
        }
      }
      
      // Rimuovi token non validi dal database
      if (invalidTokens.length > 0 && validTokens.length !== fcmTokens.length) {
        try {
          await pool.query(
            'UPDATE users SET fcm_tokens = $1 WHERE id = $2',
            [validTokens, utente.id]
          );
          console.log(`🧹 Rimossi ${fcmTokens.length - validTokens.length} token FCM non validi per utente ${utente.id}`);
        } catch (error) {
          console.error(`❌ Errore nella rimozione token FCM per utente ${utente.id}:`, error);
        }
      }
    }

    console.log(`✅ Push notifications Demos inviate: ${pushSuccessCount} successi, ${pushFailureCount} fallimenti a ${utentiConPushResult.rows.length} utenti`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche Demos:', error);
  }
}

// POST /api/comunicazioni/send-demos-notification - Invia notifica "Notifiche Demos" manualmente
router.post('/send-demos-notification', async (req, res) => {
  try {
    console.log('📢 RICEVUTA RICHIESTA INVIO NOTIFICA DEMOS');
    const { titolo, messaggio } = req.body;
    
    console.log('📝 Dati ricevuti:', { titolo, messaggio });
    
    if (!titolo) {
      console.log('❌ Titolo mancante');
      return res.status(400).json({
        success: false,
        error: 'Titolo richiesto'
      });
    }

    const commento = messaggio || titolo;
    console.log('🚀 Avvio invio notifiche...');

    // Invia la notifica a tutti gli utenti con demos: true
    await notifyAllUsers(titolo, commento);

    console.log('✅ Invio notifiche completato');

    res.json({
      success: true,
      message: 'Notifica "Notifiche Demos" inviata con successo',
      data: {
        titolo,
        messaggio: commento,
        destinatari: 'Tutti gli utenti con notifiche Demos attivate'
      }
    });
  } catch (error) {
    console.error('❌ Errore nell\'invio notifica Demos:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// GET /api/ultima-comunicazione - Ultima comunicazione dell'utente
router.get('/ultima-comunicazione', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Prima verifica se l'utente esiste nella tabella users
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Cerca comunicazioni per questo utente
    const result = await pool.query(
      `SELECT 
        c.*,
        COALESCE(SUM(CASE WHEN r.tipo = 'like' THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN r.tipo = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes
      FROM comunicazioni c
      LEFT JOIN reazioni r ON c.id::text = r.comunicazione_id
      WHERE c.id_utente = $1::uuid
      GROUP BY c.id
      ORDER BY c.data_creazione DESC
      LIMIT 1`,
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessuna comunicazione trovata per questo utente'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero ultima comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
