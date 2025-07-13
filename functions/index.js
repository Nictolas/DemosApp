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

    // Prendi tutti gli utenti che hanno scelto questo rappresentante
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

    if (tokens.length === 0) return null;

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

    const response = await admin.messaging().sendMulticast({
      tokens,
      ...payload,
    });

    console.log(
      `Notifiche inviate: ${response.successCount}/${tokens.length}`,
    );
    return null;
  }
);
