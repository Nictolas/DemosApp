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

  const utentiSnapshot = await db.collection("utenti").get();
  if (utentiSnapshot.empty) return;

  const tokens = [];
  utentiSnapshot.forEach(doc => {
    const data = doc.data();
    if (
      data.rappresentante_comunale === idUtente ||
      data.rappresentante_europeo === idUtente ||
      data.rappresentante_regionale === idUtente
    ) {
      if (data.fcmToken) tokens.push(data.fcmToken);
    }
  });

  if (tokens.length === 0) return;

  // Prepara il payload come richiesto
  const rappresentanteNome = comunicazione.nome || "";
  const rappresentanteCognome = comunicazione.cognome || "";
  const votoDato = comunicazione.voto_dato || "";
  const esito = comunicazione.vincitore === "Approvata" ? "Approvata" : "Respinta";
  const titoloVotazione = comunicazione.titolo || "Nuova comunicazione";

  const payload = {
    notification: {
      title: `${titoloVotazione} - ${rappresentanteNome} ${rappresentanteCognome} ha votato: ${votoDato}. Esito: ${esito}`,
      body: ""
    },
    tokens: tokens
  };
  console.log("Payload notifica:", JSON.stringify(payload));

  try {
    const messaging = getMessaging();
    await messaging.sendEachForMulticast(payload);
    console.log("Notifica inviata a:", tokens.length, "utenti");
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
