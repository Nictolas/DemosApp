const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("./firebase");

exports.sendComunicazioneNotification = onDocumentCreated("comunicazioni/{comId}", async (event) => {
  const comunicazione = event.data.data();
  const rappresentanteId = comunicazione.id_utente;
  const rappresentanteNome = comunicazione.nome;
  const rappresentanteCognome = comunicazione.cognome;
  const titolo = comunicazione.titolo;
  const votoDato = comunicazione.voto_dato;
  const esito = comunicazione.vincitore === "Approvata" ? "Promossa" : "Respinta";
  const comunicazioneId = event.params.comId;
  const tema = comunicazione.tema || null;

  console.log("Nuova comunicazione creata:", comunicazione);

  // 1. Elimina eventuale comunicazione precedente dello stesso rappresentante e tema
  if (tema) {
    const comunicazioniSnapshot = await admin.firestore().collection("comunicazioni")
      .where("id_utente", "==", rappresentanteId)
      .where("tema", "==", tema)
      .get();
    comunicazioniSnapshot.forEach(doc => {
      if (doc.id !== comunicazioneId) {
        doc.ref.delete();
        console.log(`Comunicazione precedente eliminata: ${doc.id}`);
      }
    });
  }

  // 2. Prendi tutti gli utenti che hanno scelto questo rappresentante
  const usersSnapshot = await admin.firestore().collection("utenti").get();
  const tokens = [];
  usersSnapshot.forEach((doc) => {
    const user = doc.data();
    const rappresentantiScelti = [
      user.rappresentante_europeo,
      user.rappresentante_camera,
      user.rappresentante_senato,
      user.rappresentante_regionale,
      user.rappresentante_comunale,
    ].filter(Boolean);
    if (
      rappresentantiScelti.includes(rappresentanteId) &&
      user.fcmToken
    ) {
      tokens.push(user.fcmToken);
    }
  });
  console.log("Token FCM trovati:", tokens);
  if (tokens.length === 0) {
    console.log("Nessun token FCM trovato. Nessuna notifica inviata.");
    return null;
  }
  // Elimina duplicati
  const uniqueTokens = [...new Set(tokens)];
  const titoloVotazione = comunicazione.titolo || "";
  const rappresentante = `${rappresentanteNome} ${rappresentanteCognome}`;
  const voto = votoDato;
  const payload = {
    notification: {
      title: titoloVotazione,
      body: `${rappresentante} ha votato: ${voto}. Esito: ${esito}`
    },
    tokens: uniqueTokens
  };
  try {
    console.log("Invio notifica a:", uniqueTokens);
    const response = await admin.messaging().sendMulticast({
      tokens: uniqueTokens,
      ...payload,
    });
    console.log(
      `Notifiche inviate: ${response.successCount}/${uniqueTokens.length}`,
      response.responses
    );
  } catch (error) {
    console.error("Errore invio notifica:", error);
  }
  return null;
}); 