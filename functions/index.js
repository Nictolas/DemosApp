const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// Funzione di notifica push su nuova comunicazione
exports.notificaComunicazione = onDocumentCreated("comunicazioni/{comId}", async (event) => {
  const comunicazione = event.data.data();
  if (!comunicazione) return;

  // Controlla ruolo
  const ruolo = comunicazione.ruolo;
  if (ruolo !== "Politico" && ruolo !== "Candidato Politico") return;

  const idUtente = comunicazione.id_utente;
  if (!idUtente) return;

  const db = getFirestore();

  // Prendi tutti gli utenti
  const utentiSnapshot = await db.collection("utenti").get();
  if (utentiSnapshot.empty) return;

  const tokens = [];
  utentiSnapshot.forEach(doc => {
    const data = doc.data();
    // Controlla se uno dei campi rappresentante corrisponde all'idUtente
    if (
      data.rappresentante_comunale === idUtente ||
      data.rappresentante_europeo === idUtente ||
      data.rappresentante_regionale === idUtente
    ) {
      if (data.fcmToken) tokens.push(data.fcmToken);
    }
  });

  if (tokens.length === 0) return;

  // Prepara la notifica
  const payload = {
    notification: {
      title: comunicazione.titolo || "Nuova comunicazione",
      body: comunicazione.nome + ": " + (comunicazione.vincitore || "Nuovo messaggio"),
    },
    tokens: tokens
  };

  // Invia la notifica push
  try {
    const messaging = getMessaging();
    await messaging.sendEachForMulticast(payload);
    console.log("Notifica inviata a:", tokens.length, "utenti");
  } catch (err) {
    console.error("Errore invio notifica:", err);
  }
});
