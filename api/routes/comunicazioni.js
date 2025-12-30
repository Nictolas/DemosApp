const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// NOTE: Le funzioni createNotificheUtente e updateNotificheUtente sono state rimosse
// perché ora si usa la colonna read_by nella tabella comunicazioni per tracciare le notifiche lette
// La tabella notifiche_utente non è più necessaria

// ===== ENDPOINTS PER COMUNICAZIONI =====

// MIDDLEWARE DI DEBUG PER TUTTE LE RICHIESTE A QUESTO ROUTER
router.use((req, res, next) => {
  console.log(`🟡 ROUTER COMUNICAZIONI: ${req.method} ${req.path} - ${req.originalUrl}`);
  if (req.path.includes('send-demos-notification') || req.originalUrl.includes('send-demos-notification')) {
    console.log('🔴 ========== ROUTER MIDDLEWARE: RICHIESTA A COMUNICAZIONI ==========');
    console.log('🔴 Method:', req.method);
    console.log('🔴 Path:', req.path);
    console.log('🔴 Original URL:', req.originalUrl);
    console.log('🔴 Base URL:', req.baseUrl);
    console.log('🔴 Full URL:', req.originalUrl);
  }
  next();
});

// POST /api/comunicazioni/send-demos-notification - Invia notifica "Notifiche Demos" manualmente
// IMPORTANTE: Questa route deve essere definita PRIMA di router.post('/') per evitare conflitti
router.post('/send-demos-notification', (req, res, next) => {
  console.log('🔵 ========== ROUTE HIT: /send-demos-notification ==========');
  console.log('🔵 Method:', req.method);
  console.log('🔵 Path:', req.path);
  console.log('🔵 Original URL:', req.originalUrl);
  console.log('🔵 Base URL:', req.baseUrl);
  console.log('🔵 Headers Authorization:', req.headers.authorization ? 'Presente' : 'Mancante');
  console.log('🔵 Timestamp richiesta:', new Date().toISOString());
  next();
}, verifyToken, async (req, res) => {
  const requestStartTime = Date.now();
  try {
    console.log('📢 ========== RICEVUTA RICHIESTA INVIO NOTIFICA DEMOS ==========');
    console.log('📢 Timestamp:', new Date().toISOString());
    console.log('📢 User ID:', req.user?.id);
    console.log('📢 Request body:', JSON.stringify(req.body));
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

    // Prima di inviare, verifica quanti utenti sono idonei
    const checkResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as totale_utenti,
        COUNT(DISTINCT CASE WHEN np.demos = true THEN u.id END) as utenti_con_demos_attivo,
        COUNT(DISTINCT CASE WHEN u.fcm_tokens IS NOT NULL AND array_length(u.fcm_tokens, 1) > 0 THEN u.id END) as utenti_con_fcm_tokens,
        COUNT(DISTINCT CASE WHEN np.demos = true AND u.fcm_tokens IS NOT NULL AND array_length(u.fcm_tokens, 1) > 0 THEN u.id END) as utenti_idonei
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE (u.status = 'a' OR u.status IS NULL)
    `);

    const stats = checkResult.rows[0];
    console.log('📊 Statistiche utenti (query iniziale):');
    console.log(`   - Totale utenti: ${stats.totale_utenti}`);
    console.log(`   - Utenti con demos=true: ${stats.utenti_con_demos_attivo}`);
    console.log(`   - Utenti con FCM tokens: ${stats.utenti_con_fcm_tokens}`);
    console.log(`   - Utenti idonei (demos=true + FCM tokens + status="a"): ${stats.utenti_idonei}`);

    // DEBUG: Verifica tutti gli utenti con FCM tokens e le loro preferenze
    const debugAllUsers = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.status,
        u.fcm_tokens,
        array_length(u.fcm_tokens, 1) as num_tokens,
        np.demos,
        np.user_id as pref_user_id,
        pg_typeof(np.demos) as demos_type,
        CASE 
          WHEN np.demos IS NULL THEN 'NULL'
          WHEN np.demos = true THEN 'true'
          WHEN np.demos = false THEN 'false'
          ELSE 'unknown'
        END as demos_status
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
      ORDER BY u.email
      LIMIT 10
    `);
    
    console.log('🔍 DEBUG: Primi 10 utenti con FCM tokens:');
    debugAllUsers.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email || user.id}:`);
      console.log(`      - Status: ${user.status}`);
      console.log(`      - FCM tokens: ${user.num_tokens}`);
      console.log(`      - demos: ${user.demos} (tipo: ${user.demos_type}, status: ${user.demos_status})`);
      console.log(`      - pref_user_id: ${user.pref_user_id || 'NULL'}`);
    });

    // Invia la notifica a tutti gli utenti con demos: true
    console.log('📤 Chiamata a notifyAllUsers...');
    const notifyResult = await notifyAllUsers(titolo, commento);
    
    console.log('📊 Risultato notifyAllUsers:', {
      success: notifyResult.success,
      inviati: notifyResult.inviati,
      errori: notifyResult.errori,
      utenti: notifyResult.utenti,
      hasError: !!notifyResult.error
    });

    // Verifica il risultato prima di rispondere
    if (notifyResult.error) {
      console.error('❌ notifyAllUsers ha generato un errore:', notifyResult.error.message);
      return res.status(500).json({
        success: false,
        error: 'Errore nell\'invio delle notifiche push',
        details: notifyResult.error.message,
        data: {
          titolo,
          messaggio: commento,
          statistiche: {
            totale_utenti: parseInt(stats.totale_utenti),
            utenti_con_demos_attivo: parseInt(stats.utenti_con_demos_attivo),
            utenti_con_fcm_tokens: parseInt(stats.utenti_con_fcm_tokens),
            utenti_idonei: parseInt(stats.utenti_idonei),
            notifiche_inviate: notifyResult.inviati,
            notifiche_fallite: notifyResult.errori
          }
        }
      });
    }

    if (notifyResult.utenti === 0) {
      console.warn('⚠️ Nessun utente idoneo trovato per l\'invio delle notifiche');
      return res.status(200).json({
        success: true,
        message: 'Nessun utente idoneo trovato per l\'invio delle notifiche',
        warning: 'Nessun utente con preferenze Demos attivate e token FCM valido',
        data: {
          titolo,
          messaggio: commento,
          statistiche: {
            totale_utenti: parseInt(stats.totale_utenti),
            utenti_con_demos_attivo: parseInt(stats.utenti_con_demos_attivo),
            utenti_con_fcm_tokens: parseInt(stats.utenti_con_fcm_tokens),
            utenti_idonei: parseInt(stats.utenti_idonei),
            notifiche_inviate: 0,
            notifiche_fallite: 0
          }
        }
      });
    }

    if (notifyResult.inviati === 0 && notifyResult.errori > 0) {
      console.error('❌ Tutte le notifiche sono fallite');
      return res.status(500).json({
        success: false,
        error: 'Tutte le notifiche push sono fallite',
        data: {
          titolo,
          messaggio: commento,
          statistiche: {
            totale_utenti: parseInt(stats.totale_utenti),
            utenti_con_demos_attivo: parseInt(stats.utenti_con_demos_attivo),
            utenti_con_fcm_tokens: parseInt(stats.utenti_con_fcm_tokens),
            utenti_idonei: parseInt(stats.utenti_idonei),
            notifiche_inviate: notifyResult.inviati,
            notifiche_fallite: notifyResult.errori
          }
        }
      });
    }

    console.log('✅ Invio notifiche completato con successo');

    res.json({
      success: true,
      message: notifyResult.errori > 0 
        ? `Notifica "Notifiche Demos" inviata con successo (${notifyResult.inviati} inviate, ${notifyResult.errori} fallite)`
        : 'Notifica "Notifiche Demos" inviata con successo',
      data: {
        titolo,
        messaggio: commento,
        destinatari: 'Tutti gli utenti con notifiche Demos attivate',
        statistiche: {
          totale_utenti: parseInt(stats.totale_utenti),
          utenti_con_demos_attivo: parseInt(stats.utenti_con_demos_attivo),
          utenti_con_fcm_tokens: parseInt(stats.utenti_con_fcm_tokens),
          utenti_idonei: parseInt(stats.utenti_idonei),
          notifiche_inviate: notifyResult.inviati,
          notifiche_fallite: notifyResult.errori,
          utenti_notificati: notifyResult.utenti
        }
      }
    });
  } catch (error) {
    const requestDuration = Date.now() - requestStartTime;
    console.error('❌ ========== ERRORE NELL\'INVIO NOTIFICA DEMOS ==========');
    console.error('❌ Timestamp:', new Date().toISOString());
    console.error('❌ User ID:', req.user?.id);
    console.error('❌ Errore:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ Durata richiesta:', `${requestDuration}ms`);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

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

    // Gestione speciale per "Informa Cittadini" - ora gestita da /api/informa-cittadini
    // Questo codice è stato spostato in api/routes/informa-cittadini.js che usa notifiche_comunali
    if (tipo === 'informa_cittadini') {
      return res.status(400).json({
        success: false,
        error: 'Usa l\'endpoint /api/informa-cittadini per questa funzionalità'
      });
    }

    // Gestione speciale per notifiche di Demos - ora gestita da notifyAllUsers che usa notifiche_demos
    if (tipo === 'demos_notification') {
      // Invia notifica a TUTTI gli utenti usando notifiche_demos
      await notifyAllUsers(titolo, commento || '');

      return res.status(201).json({
        success: true,
        message: 'Notifica Demos inviata a tutti gli utenti'
      });
    }

    // Gestione speciale per "Istituzione" - crea più righe (una per voto) con upsert
    if (tipo === 'istituzione' && voti && Array.isArray(voti) && voti.length > 0) {
      // Recupera comune_residenza dell'utente operante (Istituzione)
      const utenteOperanteResult = await pool.query(
        'SELECT comune_residenza FROM users WHERE id = $1',
        [id_utente]
      );
      
      if (utenteOperanteResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Utente operante non trovato'
        });
      }
      
      const comuneResidenzaOperante = utenteOperanteResult.rows[0].comune_residenza;
      
      if (!comuneResidenzaOperante) {
        return res.status(400).json({
          success: false,
          error: 'Comune residenza dell\'utente operante non trovato. Imposta il comune residenza nel tuo profilo.'
        });
      }

      const comunicazioni = [];
      const { getFirebaseAdmin } = require('../services/firebaseAdmin');
      const admin = getFirebaseAdmin();

      for (const voto of voti) {
        if (!voto.nome || !voto.voto) continue;

        // Cerca l'utente per nome completo (deve essere "Nome Cognome")
        const utenteResult = await pool.query(
          `SELECT id, nome, cognome, ruolo FROM users 
           WHERE CONCAT(nome, ' ', cognome) = $1
           LIMIT 1`,
          [voto.nome.trim()]
        );

        if (utenteResult.rows.length === 0) {
          console.log(`⚠️ Consigliere comunale non trovato per: ${voto.nome}`);
          return res.status(400).json({
            success: false,
            error: `Consigliere comunale "${voto.nome}" non trovato. Assicurati di selezionare un consigliere dalla lista suggerita.`
          });
        }

        const utentePolitico = utenteResult.rows[0];
        const nomeCompletoPolitico = `${utentePolitico.nome} ${utentePolitico.cognome}`;
        const testo = `Il voto di ${nomeCompletoPolitico}: ${voto.voto}`;
        const titoloCompleto = `${titolo} - ${nomeCompletoPolitico}`;

        // Upsert: se esiste già una riga con stesso comune_residenza e politico, la sovrascrive
        const existingResult = await pool.query(
          `SELECT id FROM notifiche_voti_comuni 
           WHERE comune_residenza = $1 AND politico = $2`,
          [comuneResidenzaOperante, nomeCompletoPolitico]
        );

        let result;
        if (existingResult.rows.length > 0) {
          // Aggiorna riga esistente
          result = await pool.query(
            `UPDATE notifiche_voti_comuni SET
              id_utente = $1,
              titolo = $2,
              testo = $3,
              voto = $4,
              data = CURRENT_DATE,
              data_creazione = CURRENT_TIMESTAMP,
              likes = 0,
              dislikes = 0
            WHERE comune_residenza = $5 AND politico = $6
            RETURNING *`,
            [utentePolitico.id, titoloCompleto, testo, voto.voto, comuneResidenzaOperante, nomeCompletoPolitico]
          );
          console.log(`🔄 Aggiornata riga esistente per ${nomeCompletoPolitico} nel comune ${comuneResidenzaOperante}`);
        } else {
          // Inserisci nuova riga
          result = await pool.query(
            `INSERT INTO notifiche_voti_comuni (
              id, id_utente, titolo, testo, voto, comune_residenza, politico, likes, dislikes, data, data_creazione
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, 0, CURRENT_DATE, CURRENT_TIMESTAMP
            ) RETURNING *`,
            [utentePolitico.id, titoloCompleto, testo, voto.voto, comuneResidenzaOperante, nomeCompletoPolitico]
          );
          console.log(`✅ Inserita nuova riga per ${nomeCompletoPolitico} nel comune ${comuneResidenzaOperante}`);
        }

        comunicazioni.push(result.rows[0]);

        // Trova gli utenti che hanno questo rappresentante come rappresentante_comune
        // Gestisce sia UUID che TEXT per rappresentante_comune
        const rappresentanteComuneType = await pool.query(`
          SELECT data_type, udt_name
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'rappresentante_comune'
        `);
        
        const isUUID = rappresentanteComuneType.rows.length > 0 && 
                       (rappresentanteComuneType.rows[0].udt_name === 'uuid' || 
                        rappresentanteComuneType.rows[0].data_type === 'uuid');
        
        // Usa la preferenza specifica per consigliere_comunale
        const utentiConRappresentante = isUUID
          ? await pool.query(
              `SELECT u.id, u.fcm_tokens, u.email, u.nome, u.cognome, 
                      COALESCE(np.consigliere_comunale, false) as consigliere_comunale
               FROM users u
               LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
               WHERE u.rappresentante_comune = $1::uuid
                 AND (u.status = 'a' OR u.status IS NULL)
                 AND u.fcm_tokens IS NOT NULL 
                 AND array_length(u.fcm_tokens, 1) > 0
                 AND (np.consigliere_comunale = true OR np.consigliere_comunale IS NULL)`,
              [utentePolitico.id]
            )
          : await pool.query(
              `SELECT u.id, u.fcm_tokens, u.email, u.nome, u.cognome,
                      COALESCE(np.consigliere_comunale, false) as consigliere_comunale
               FROM users u
               LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
               WHERE u.rappresentante_comune::text = $1::text
                 AND (u.status = 'a' OR u.status IS NULL)
                 AND u.fcm_tokens IS NOT NULL 
                 AND array_length(u.fcm_tokens, 1) > 0
                 AND (np.consigliere_comunale = true OR np.consigliere_comunale IS NULL)`,
              [utentePolitico.id]
            );

        console.log(`📢 Trovati ${utentiConRappresentante.rows.length} utenti con rappresentante_comune = ${utentePolitico.id}`);

        // Invia notifica push solo agli utenti che hanno questo rappresentante
        if (admin && utentiConRappresentante.rows.length > 0) {
          const pushTitle = `Voto del tuo rappresentante: ${utentePolitico.nome} ${utentePolitico.cognome}`;
          const pushBody = `${titolo}: ${voto.voto}`;

          for (const utenteDestinatario of utentiConRappresentante.rows) {
            const fcmTokens = utenteDestinatario.fcm_tokens || [];
            
            for (const token of fcmTokens) {
              if (token && token.trim()) {
                try {
                  await sendPushNotification(
                    token,
                    pushTitle,
                    pushBody,
                    {
                      type: 'istituzione',
                      comunicazione_id: result.rows[0].id,
                      rappresentante_id: utentePolitico.id,
                      titolo: titolo,
                      voto: voto.voto,
                      url: '/comunica',
                      link: 'https://www.demos.community/comunica'
                    }
                  );
                } catch (error) {
                  console.error(`❌ Errore invio notifica a ${utenteDestinatario.email}:`, error);
                }
              }
            }
          }
        }
      }

      return res.status(201).json({
        success: true,
        data: comunicazioni,
        message: `${comunicazioni.length} voti istituzionali salvati con successo`
      });
    }

    // Per comunicazioni che devono essere sovrascritte (votazione, comunicazione)
    // Controlla se esiste già una comunicazione per questo utente con lo stesso tipo
    const tipiSovrascrivibili = ['votazione', 'comunicazione'];
    const existingComunicazione = tipiSovrascrivibili.includes(tipo) 
      ? await pool.query(
          'SELECT id FROM comunicazioni WHERE id_utente = $1 AND tipo = $2 ORDER BY data_creazione DESC LIMIT 1',
          [id_utente, tipo]
        )
      : { rows: [] };

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
        WHERE id = $6 
        RETURNING *`,
        [titolo, testo, voto_dato, vincitore, commento || '', comunicazioneId]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      // Reset read_by per renderla non letta per tutti (sovrascrittura)
      const readByTypeCheck = await pool.query(`
        SELECT udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' 
        AND column_name = 'read_by'
      `);
      const isUUIDArray = readByTypeCheck.rows.length > 0 && readByTypeCheck.rows[0].udt_name?.includes('uuid');
      const readByInit = isUUIDArray ? 'ARRAY[]::UUID[]' : 'ARRAY[]::VARCHAR[]';
      
      await pool.query(`
        UPDATE comunicazioni 
        SET read_by = ${readByInit}
        WHERE id = $1
      `, [comunicazioneId]);

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
          data_creazione, likes, dislikes, punti_trasparenza, tipo
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3, $8
        ) RETURNING *`,
        [id_utente, titolo, testo, zona || 'Generale', voto_dato, vincitore, commento || '', tipo]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

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

    // NOTE: Le notifiche ai sostenitori ora vengono gestite tramite la tabella comunicazioni
    // con la colonna read_by. La tabella notifiche_utente non è più utilizzata.
    // Le comunicazioni create/aggiornate sono visibili a tutti gli utenti tramite GET /api/notifiche
    console.log(`✅ Comunicazione disponibile per ${sostenitoriResult.rows.length} sostenitori`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche ai sostenitori:', error);
  }
}

// Funzione helper per inviare push notification usando Firebase Admin SDK
async function sendPushNotification(fcmToken, title, body, data = {}) {
  try {
    if (!fcmToken || !fcmToken.trim()) {
      console.error('❌ sendPushNotification: Token FCM vuoto o non valido');
      return { success: false, error: 'Token FCM non valido' };
    }

    // Inizializza Firebase Admin se non già fatto
    const { getFirebaseAdmin } = require('../services/firebaseAdmin');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.error('❌ sendPushNotification: Firebase Admin non disponibile');
      console.error('❌ Verifica la configurazione di Firebase Admin (variabili d\'ambiente o serviceAccountKey.json)');
      return { success: false, error: 'Firebase Admin non configurato' };
    }
    
    console.log('✅ sendPushNotification: Firebase Admin disponibile');

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
    console.log(`📤 sendPushNotification: Invio notifica push a Firebase...`);
    console.log(`   Token (primi 50 caratteri): ${fcmToken.substring(0, 50)}...`);
    console.log(`   Titolo: ${title}`);
    console.log(`   Body: ${body}`);
    console.log(`   Data:`, JSON.stringify(data));
    console.log(`   Message completo:`, JSON.stringify(message, null, 2));
    
    try {
      console.log('📤 sendPushNotification: Chiamata a admin.messaging().send()...');
      const response = await admin.messaging().send(message);
      console.log(`✅ sendPushNotification: Push notification inviata con successo a Firebase`);
      console.log(`   Message ID: ${response}`);
      console.log(`   Firebase ha accettato la notifica e la invierà al dispositivo`);
      
      return { success: true, messageId: response };
    } catch (sendError) {
      console.error(`❌ sendPushNotification: Errore durante l'invio a Firebase`);
      console.error(`   Error name: ${sendError.name || 'N/A'}`);
      console.error(`   Error message: ${sendError.message || 'N/A'}`);
      console.error(`   Error code: ${sendError.code || 'N/A'}`);
      console.error(`   Error stack: ${sendError.stack || 'N/A'}`);
      console.error(`   Token (primi 50 caratteri): ${fcmToken?.substring(0, 50) || 'N/A'}...`);
      
      // Gestisci errori specifici di FCM
      if (sendError.code === 'messaging/invalid-registration-token' || 
          sendError.code === 'messaging/registration-token-not-registered') {
        console.warn(`⚠️ sendPushNotification: Token FCM non valido o non registrato - verrà rimosso dal database`);
        return { success: false, error: 'Token non valido', shouldRemoveToken: true, code: sendError.code };
      }
      
      // Se è un errore di autenticazione/configurazione Firebase
      if (sendError.code === 'app/invalid-credential' || 
          sendError.code === 'auth/invalid-credential' ||
          sendError.message?.includes('credential') ||
          sendError.message?.includes('authentication')) {
        console.error(`❌ sendPushNotification: Errore di autenticazione Firebase - verifica le credenziali`);
        return { success: false, error: 'Errore di autenticazione Firebase', code: sendError.code };
      }
      
      throw sendError;
    }
  } catch (error) {
    // Gestisci altri errori
    console.error('❌ sendPushNotification: Errore generale nell\'invio push notification');
    console.error('   Error name:', error.name || 'N/A');
    console.error('   Error message:', error.message || 'N/A');
    console.error('   Error code:', error.code || 'N/A');
    console.error('   Error stack:', error.stack || 'N/A');
    console.error('   Token (primi 50 caratteri):', fcmToken?.substring(0, 50) || 'N/A');
    
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'Token non valido', shouldRemoveToken: true, code: error.code };
    }
    
    return { success: false, error: error.message || 'Errore sconosciuto', code: error.code };
  }
}

// Funzione per notificare tutti gli utenti (per notifiche Demos)
// Restituisce: { success: boolean, inviati: number, errori: number, utenti: number, error?: Error }
async function notifyAllUsers(titolo, commento) {
  let pushSuccessCount = 0;
  let pushFailureCount = 0;
  let utentiTrovati = 0;
  
  try {
    console.log('🚀 notifyAllUsers: Inizio invio notifiche Demos');
    
    // Usa un id_utente valido (non può essere NULL)
    // Prendi il primo utente attivo come mittente sistema
    const systemUserResult = await pool.query(`
      SELECT id FROM users WHERE status = 'a' LIMIT 1
    `);
    const systemUserId = systemUserResult.rows.length > 0 ? systemUserResult.rows[0].id : null;
    
    if (!systemUserId) {
      const error = new Error('Nessun utente attivo trovato per creare la comunicazione');
      console.error('❌ notifyAllUsers:', error.message);
      return { success: false, inviati: 0, errori: 0, utenti: 0, error };
    }
    
    // Controlla se esiste già una notifica Demos e la sovrascrivi
    const existingDemosNotification = await pool.query(`
      SELECT id FROM notifiche_demos ORDER BY data DESC NULLS LAST LIMIT 1
    `);
    
    let comunicazioneId;
    
    if (existingDemosNotification.rows.length > 0) {
      // Aggiorna comunicazione esistente (sovrascrittura)
      comunicazioneId = existingDemosNotification.rows[0].id;
      
      // Reset reazioni
      await pool.query('DELETE FROM reazioni WHERE comunicazione_id = $1', [comunicazioneId]);
      
      // Aggiorna la comunicazione in notifiche_demos
      const comunicazioneResult = await pool.query(`
        UPDATE notifiche_demos SET
          id_utente = $1,
          titolo = $2,
          testo = $3,
          data = CURRENT_DATE
        WHERE id = $4
        RETURNING id
      `, [
        systemUserId,
        `Notifica Demos: ${titolo}`,
        commento || titolo,
        comunicazioneId
      ]);
      
      console.log(`✅ Notifica Demos aggiornata (sovrascritta) con ID: ${comunicazioneId}`);
    } else {
      // Crea nuova comunicazione solo se non esiste
      const comunicazioneResult = await pool.query(`
        INSERT INTO notifiche_demos (
          id, id_utente, titolo, testo, data
        ) VALUES (
          gen_random_uuid(), $3, $1, $2, CURRENT_DATE
        ) RETURNING id
      `, [
        `Notifica Demos: ${titolo}`,
        commento || titolo,
        systemUserId
      ]);

      comunicazioneId = comunicazioneResult.rows[0].id;
      console.log(`✅ Notifica Demos creata con ID: ${comunicazioneId}`);
    }

    // Prima verifica quanti utenti hanno FCM tokens
    const utentiConFCMResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE (u.status = $1 OR u.status IS NULL)
        AND u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
    `, ['a']);
    console.log(`📊 Utenti con FCM tokens: ${utentiConFCMResult.rows[0].count}`);

    // Verifica quanti utenti hanno preferenze
    const utentiConPreferenzeResult = await pool.query(`
      SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN np.demos = true THEN 1 END) as demos_true,
        COUNT(CASE WHEN np.demos = false THEN 1 END) as demos_false,
        COUNT(CASE WHEN np.demos IS NULL THEN 1 END) as demos_null
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE (u.status = $1 OR u.status IS NULL)
    `, ['a']);
    const prefStats = utentiConPreferenzeResult.rows[0];
    console.log(`📊 Statistiche preferenze Demos:`);
    console.log(`   - Totale utenti con preferenze: ${prefStats.totale}`);
    console.log(`   - demos = true: ${prefStats.demos_true}`);
    console.log(`   - demos = false: ${prefStats.demos_false}`);
    console.log(`   - demos = NULL: ${prefStats.demos_null}`);

    // Recupera solo gli utenti che hanno attivato "Notifiche Demos" e hanno FCM tokens
    // IMPORTANTE: Filtra per u.status = 'a' per allinearsi con la query iniziale
    console.log('🔍 Eseguendo query per utenti con demos=true, FCM tokens e status="a"...');
    const utentiConPushResult = await pool.query(`
      SELECT u.id, u.fcm_tokens, u.email, u.nome, u.cognome,
             np.demos as demos,
             u.status,
             pg_typeof(np.demos) as demos_type
      FROM users u
      INNER JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE np.demos = true
        AND (u.status = 'a' OR u.status IS NULL)
        AND u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
    `);
    
    console.log(`🔍 Query con filtro status: trovati ${utentiConPushResult.rows.length} utenti`);
    
    // Se non trova utenti, prova anche con LEFT JOIN e COALESCE
    if (utentiConPushResult.rows.length === 0) {
      console.log('⚠️ Nessun utente trovato con INNER JOIN, provo con LEFT JOIN...');
      const utentiConPushResult2 = await pool.query(`
        SELECT u.id, u.fcm_tokens, u.email, u.nome, u.cognome,
               np.demos as demos,
               u.status,
               pg_typeof(np.demos) as demos_type
        FROM users u
        LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
        WHERE COALESCE(np.demos, false) = true
          AND (u.status = 'a' OR u.status IS NULL)
          AND u.fcm_tokens IS NOT NULL 
          AND array_length(u.fcm_tokens, 1) > 0
      `);
      
      console.log(`🔍 Query con LEFT JOIN e COALESCE: trovati ${utentiConPushResult2.rows.length} utenti`);
      
      if (utentiConPushResult2.rows.length > 0) {
        utentiConPushResult.rows = utentiConPushResult2.rows;
      }
    }
    
    // Se ancora non trova, prova una query ancora più semplice
    if (utentiConPushResult.rows.length === 0) {
      console.log('⚠️ Ancora nessun utente trovato, provo query semplificata...');
      const utentiConPushResult3 = await pool.query(`
        SELECT u.id, u.fcm_tokens, u.email, u.nome, u.cognome,
               np.demos as demos,
               u.status
        FROM users u, notifiche_preferenze np
        WHERE u.id = np.user_id
          AND np.demos IS TRUE
          AND (u.status = 'a' OR u.status IS NULL)
          AND u.fcm_tokens IS NOT NULL 
          AND array_length(u.fcm_tokens, 1) > 0
      `);
      
      console.log(`🔍 Query semplificata: trovati ${utentiConPushResult3.rows.length} utenti`);
      
      if (utentiConPushResult3.rows.length > 0) {
        utentiConPushResult.rows = utentiConPushResult3.rows;
      }
    }

    console.log(`🔍 Utenti trovati con demos: true e FCM tokens: ${utentiConPushResult.rows.length}`);
    
    // Debug: verifica utenti specifici con FCM ma senza demos=true
    const debugUtentiResult = await pool.query(`
      SELECT u.id, u.email, u.fcm_tokens, np.demos, 
             array_length(u.fcm_tokens, 1) as num_tokens
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE (u.status = $1 OR u.status IS NULL)
        AND u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
      LIMIT 5
    `, ['a']);
    console.log(`🔍 Esempi utenti con FCM tokens (primi 5):`);
    debugUtentiResult.rows.forEach((utente, index) => {
      console.log(`   ${index + 1}. ${utente.email || utente.id}: demos=${utente.demos} (${typeof utente.demos}), tokens=${utente.num_tokens}`);
    });
    
    // Log dettagliato per debug
    if (utentiConPushResult.rows.length > 0) {
      console.log('📋 Dettagli utenti che riceveranno la notifica:');
      utentiConPushResult.rows.forEach((utente, index) => {
        console.log(`   ${index + 1}. ${utente.email || utente.id} - Token FCM: ${utente.fcm_tokens?.length || 0} token(s)`);
        if (utente.fcm_tokens && utente.fcm_tokens.length > 0) {
          utente.fcm_tokens.forEach((token, tokenIndex) => {
            console.log(`      Token ${tokenIndex + 1}: ${token.substring(0, 30)}...`);
          });
        }
      });
    }
    
    utentiTrovati = utentiConPushResult.rows.length;
    
    if (utentiTrovati === 0) {
      console.log('ℹ️ Nessun utente con push notifications attive per Demos');
      console.log('💡 Verifica che gli utenti abbiano:');
      console.log('   1. notifiche_preferenze.demos = true');
      console.log('   2. fcm_tokens non vuoto');
      console.log('   3. status = "a" (attivo)');
      
      // Query di debug per vedere quanti utenti hanno FCM tokens ma non demos=true
      const debugResult = await pool.query(`
        SELECT 
          COUNT(DISTINCT u.id) as utenti_con_fcm_senza_demos,
          COUNT(DISTINCT CASE WHEN np.demos IS NULL THEN u.id END) as utenti_senza_preferenze,
          COUNT(DISTINCT CASE WHEN np.demos = false THEN u.id END) as utenti_con_demos_false
        FROM users u
        LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
        WHERE (u.status = $1 OR u.status IS NULL)
          AND u.fcm_tokens IS NOT NULL 
          AND array_length(u.fcm_tokens, 1) > 0
          AND (np.demos IS NULL OR np.demos = false)
      `, ['a']);
      
      const debug = debugResult.rows[0];
      console.log('🔍 Debug utenti con FCM ma senza demos=true:');
      console.log(`   - Utenti con FCM ma demos non attivo: ${debug.utenti_con_fcm_senza_demos}`);
      console.log(`   - Utenti senza record preferenze: ${debug.utenti_senza_preferenze}`);
      console.log(`   - Utenti con demos=false: ${debug.utenti_con_demos_false}`);
      
      console.log('✅ notifyAllUsers: Completato (nessun utente idoneo)');
      return { success: true, inviati: 0, errori: 0, utenti: 0 };
    }

    // Invia push notifications solo agli utenti con preferenza attiva
    const pushTitle = `Notifica Demos: ${titolo}`;
    const pushBody = commento || titolo;

    const invalidTokens = []; // Raccogli token non validi da rimuovere
    
    console.log(`📤 Invio push notifications a ${utentiConPushResult.rows.length} utenti...`);
    console.log(`📋 Dettagli utenti che riceveranno la notifica:`);
    utentiConPushResult.rows.forEach((utente, index) => {
      console.log(`   ${index + 1}. ${utente.email || utente.id}:`);
      console.log(`      - Token FCM: ${utente.fcm_tokens?.length || 0} token(s)`);
      if (utente.fcm_tokens && utente.fcm_tokens.length > 0) {
        utente.fcm_tokens.forEach((token, tokenIndex) => {
          console.log(`         Token ${tokenIndex + 1}: ${token.substring(0, 50)}...`);
        });
      }
    });
    
    for (const utente of utentiConPushResult.rows) {
      const fcmTokens = utente.fcm_tokens || [];
      const validTokens = [];
      
      console.log(`  📱 Utente ${utente.email || utente.id}: ${fcmTokens.length} token(s) FCM`);
      
      // Invia push notification a tutti i token FCM dell'utente
      for (const token of fcmTokens) {
        if (token && token.trim()) {
          console.log(`    🔔 Invio notifica push a token: ${token.substring(0, 50)}...`);
          
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
            console.log(`    ✅ Notifica inviata con successo a Firebase`);
            if (result.messageId) {
              console.log(`    📨 Message ID: ${result.messageId}`);
            }
          } else {
            pushFailureCount++;
            console.log(`    ❌ Errore invio notifica: ${result.error}`);
            if (result.code) {
              console.log(`    📋 Error code: ${result.code}`);
            }
            // Se il token non è valido, segnalo per rimozione
            if (result.shouldRemoveToken) {
              invalidTokens.push({ userId: utente.id, token });
              console.log(`    🗑️ Token marcato per rimozione (non valido o scaduto)`);
            } else {
              validTokens.push(token); // Mantieni il token se l'errore è temporaneo
              console.log(`    ⚠️ Errore temporaneo, token mantenuto`);
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

    console.log(`✅ Push notifications Demos inviate: ${pushSuccessCount} successi, ${pushFailureCount} fallimenti a ${utentiTrovati} utenti`);
    console.log('✅ notifyAllUsers: Completato con successo');
    
    return {
      success: pushFailureCount === 0 || pushSuccessCount > 0,
      inviati: pushSuccessCount,
      errori: pushFailureCount,
      utenti: utentiTrovati
    };
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche Demos:', error);
    console.error('❌ Stack trace:', error.stack);
    console.log('❌ notifyAllUsers: Completato con errori');
    
    return {
      success: false,
      inviati: pushSuccessCount,
      errori: pushFailureCount,
      utenti: utentiTrovati,
      error: error
    };
  }
}

// GET /api/comunicazioni/debug-notifiche-demos - Debug per verificare lo stato delle notifiche Demos
router.get('/debug-notifiche-demos', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verifica lo stato dell'utente corrente con query più dettagliate
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.nome,
        u.cognome,
        u.status,
        u.fcm_tokens,
        array_length(u.fcm_tokens, 1) as num_tokens,
        np.demos as demos_preferenza,
        pg_typeof(np.demos) as demos_type,
        np.user_id as pref_user_id,
        CASE 
          WHEN np.demos IS NULL THEN 'NULL'
          WHEN np.demos = true THEN 'true'
          WHEN np.demos = false THEN 'false'
          ELSE 'unknown'
        END as demos_status,
        CASE 
          WHEN u.fcm_tokens IS NOT NULL AND array_length(u.fcm_tokens, 1) > 0 THEN true 
          ELSE false 
        END as ha_fcm_tokens,
        CASE 
          WHEN np.demos = true AND u.fcm_tokens IS NOT NULL AND array_length(u.fcm_tokens, 1) > 0 THEN true 
          ELSE false 
        END as ricevera_notifiche
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE u.id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    const fcmTokens = user.fcm_tokens || [];
    
    // Query aggiuntiva per vedere tutti gli utenti con FCM e demos
    const allUsersResult = await pool.query(`
      SELECT 
        COUNT(*) as totale_utenti_fcm,
        COUNT(CASE WHEN np.demos = true THEN 1 END) as utenti_demos_true,
        COUNT(CASE WHEN np.demos = false THEN 1 END) as utenti_demos_false,
        COUNT(CASE WHEN np.demos IS NULL THEN 1 END) as utenti_demos_null
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
    `);
    
    res.json({
      success: true,
      data: {
        utente: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          status: user.status
        },
        preferenze: {
          demos_attivo: user.demos_preferenza === true,
          demos_value: user.demos_preferenza,
          demos_type: user.demos_type,
          demos_status: user.demos_status,
          pref_user_id: user.pref_user_id,
          ha_fcm_tokens: user.ha_fcm_tokens,
          numero_token_fcm: fcmTokens.length,
          ricevera_notifiche: user.ricevera_notifiche
        },
        token_fcm: fcmTokens.length > 0 ? fcmTokens.map(t => ({
          preview: t ? `${t.substring(0, 30)}...` : null,
          length: t ? t.length : 0
        })) : [],
        statistiche_globali: allUsersResult.rows[0]
      }
    });
  } catch (error) {
    console.error('❌ Errore nel debug notifiche Demos:', error);
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
    
    // Cerca comunicazioni per questo utente in notifiche_voti_comuni
    const result = await pool.query(
      `SELECT 
        c.*,
        COALESCE(SUM(CASE WHEN r.tipo = 'like' THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN r.tipo = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes,
        COALESCE(c.data, c.data_creazione) as data_creazione
      FROM notifiche_voti_comuni c
      LEFT JOIN reazioni r ON c.id::text = r.comunicazione_id
      WHERE c.id_utente = $1::uuid
      GROUP BY c.id
      ORDER BY COALESCE(c.data, c.data_creazione) DESC
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
