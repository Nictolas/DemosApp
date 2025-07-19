// --- IMPORTS E INIZIALIZZAZIONE ---
const { onDocumentCreated } = require("firebase-functions/v2/firestore"); // v2 Firestore trigger
const functions = require("firebase-functions"); // v1 per PubSub
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const { getMessaging } = require("firebase-admin/messaging");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// --- FUNZIONE FIRESTORE TRIGGER (v2) ---
exports.notificaComunicazione = onDocumentCreated("comunicazioni/{comId}", async (event) => {
  console.log("=== TEST LOG: NOTIFICA FUNZIONE ESEGUITA ===");
  const comunicazione = event.data.data();
  if (!comunicazione) return;

  // Controlla ruolo
  const ruolo = comunicazione.ruolo;
  if (ruolo !== "Politico" && ruolo !== "Candidato Politico") return;

  const idUtente = comunicazione.id_utente;
  if (!idUtente) return;

  // Prepara il payload come richiesto
  const rappresentanteNome = comunicazione.nome || "";
  const rappresentanteCognome = comunicazione.cognome || "";
  const votoDato = comunicazione.voto_dato || "";
  const esito = comunicazione.vincitore === "Approvata" ? "Approvata" : "Respinta";
  const titoloVotazione = comunicazione.titolo || "Nuova comunicazione";

  // 2. Prendi tutti gli utenti che hanno scelto questo rappresentante
  const utentiSnapshot = await db.collection("utenti").get();
  let tokens = [];
  utentiSnapshot.forEach(doc => {
    const data = doc.data();
    const rappresentantiScelti = [
      data.rappresentante_europeo,
      data.rappresentante_camera,
      data.rappresentante_senato,
      data.rappresentante_regionale,
      data.rappresentante_comunale,
    ].filter(Boolean);
    if (rappresentantiScelti.includes(idUtente)) {
      if (Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) {
        // Prendi solo il primo token valido per ogni utente
        tokens.push(data.fcmTokens[0]);
        console.log(`Token FCM (primo) per utente ${doc.id}:`, data.fcmTokens[0]);
      }
    }
  });
  // Elimina eventuali duplicati (in teoria non dovrebbero esserci)
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 0) return;
  const payload = {
    notification: {
      title: titoloVotazione,
      body: `${rappresentanteNome} ${rappresentanteCognome} ha votato: ${votoDato}. Esito: ${esito}`
    },
    tokens: uniqueTokens
  };
  console.log("Payload notifica (imbuto, solo un token per utente):", JSON.stringify(payload));
  try {
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(payload);
    console.log("Notifica inviata a:", uniqueTokens.length, "utenti");
    // Rimuovi token non validi
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push(uniqueTokens[idx]);
      }
    });
    if (failedTokens.length > 0) {
      // Rimuovi i token non validi da tutti gli utenti che li hanno
      const batch = db.batch();
      utentiSnapshot.forEach(doc => {
        const data = doc.data();
        const ref = doc.ref;
        if (Array.isArray(data.fcmTokens)) {
          const toRemove = failedTokens.filter(t => data.fcmTokens.includes(t));
          if (toRemove.length > 0) {
            batch.update(ref, {
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...toRemove)
            });
          }
        }
      });
      await batch.commit();
      console.log("Token FCM non validi rimossi:", failedTokens);
    }
  } catch (err) {
    console.error("Errore invio notifica:", err);
  }
});

// --- FUNZIONE SCHEDULED (v2, Scheduler) ---
exports.deleteOldNotifications = onSchedule(
  {
    schedule: "0 3 */2 * *", // ogni 2 giorni alle 3:00
    timeZone: "Europe/Rome",
  },
  async (event) => {
    const giorni = 15; // Cancella notifiche più vecchie di 15 giorni
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - giorni);

    const notificheRef = db.collection("comunicazioni")
      .where("data_creazione", "<", dataLimite.toISOString());

    const snapshot = await notificheRef.get();

    if (snapshot.empty) {
      console.log("Nessuna notifica da cancellare.");
      return null;
    }

    let batch = db.batch();
    let count = 0;
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 500 !== 0) {
      await batch.commit();
    }

    console.log(`Cancellate ${count} notifiche più vecchie di ${giorni} giorni.`);
    return null;
  }
);
