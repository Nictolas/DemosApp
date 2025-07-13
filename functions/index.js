/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendComunicazioneNotification = onDocumentCreated(
  "comunicazioni/{comId}",
  async (event) => {
    const comunicazione = event.data.data();
    const rappresentanteId = comunicazione.id_utente;
    const rappresentanteNome = comunicazione.nome;
    const rappresentanteCognome = comunicazione.cognome;
    const titolo = comunicazione.titolo;
    const votoDato = comunicazione.voto_dato;
    const vincitore = comunicazione.vincitore;
    const comunicazioneId = event.params.comId;

    console.log("Nuova comunicazione creata:", comunicazione);
    // Prendi tutti gli utenti che hanno scelto questo rappresentante
    const usersSnapshot = await admin.firestore().collection("utenti").get();
    const tokens = [];
    const utentiDestinatari = [];

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
        utentiDestinatari.push({ id: doc.id, ...user });
      }
    });

    console.log("Utenti destinatari trovati:", utentiDestinatari.length, utentiDestinatari.map(u => u.email || u.id));
    console.log("Token FCM trovati:", tokens);

    if (tokens.length === 0) {
      console.log("Nessun token FCM trovato. Nessuna notifica inviata.");
      return null;
    }

    const payload = {
      notification: {
        title: `Nuova comunicazione da ${rappresentanteNome} ${rappresentanteCognome}`,
        body: `${titolo} - Voto: ${votoDato}`,
      },
      data: {
        type: "comunicazione",
        comunicazioneId,
        rappresentanteId,
        votoDato,
        vincitore,
      },
    };

    try {
      console.log("Invio notifica a:", tokens);
      const response = await admin.messaging().sendMulticast({
        tokens,
        ...payload,
      });
      console.log(
        `Notifiche inviate: ${response.successCount}/${tokens.length}`,
        response.responses
      );
    } catch (error) {
      console.error("Errore invio notifica:", error);
    }
    return null;
  }
);
