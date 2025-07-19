const functions = require("firebase-functions");
const admin = require("./firebase");

exports.sendComunicazioneNotification = functions.firestore
  .document("comunicazioni/{comId}")
  .onCreate(async (snap, context) => {
    const comunicazione = snap.data();
    const rappresentanteId = comunicazione.id_utente;
    const rappresentanteNome = comunicazione.nome;
    const rappresentanteCognome = comunicazione.cognome;
    const titolo = comunicazione.titolo;
    const votoDato = comunicazione.voto_dato;
    const vincitore = comunicazione.vincitore;
    const comunicazioneId = context.params.comId;
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
  }); 