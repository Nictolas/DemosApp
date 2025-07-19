const functions = require("firebase-functions");
const admin = require("./firebase");

exports.deleteUserData = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const db = admin.firestore();
  console.log(`[deleteUserData] Triggered for UID: ${uid}`);

  try {
    // Elimina il documento profilo utente
    const userDoc = db.collection("utenti").doc(uid);
    const userSnap = await userDoc.get();
    if (userSnap.exists) {
      await userDoc.delete();
      console.log(`[deleteUserData] Documento utente ${uid} eliminato.`);
    } else {
      console.log(`[deleteUserData] Documento utente ${uid} NON trovato.`);
    }

    // Elimina tutte le opinioni dell’utente
    const opinioniSnap = await db.collection("opinioni").where("uid", "==", uid).get();
    if (!opinioniSnap.empty) {
      const batch = db.batch();
      opinioniSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[deleteUserData] Opinioni utente ${uid} eliminate (${opinioniSnap.size}).`);
    } else {
      console.log(`[deleteUserData] Nessuna opinione trovata per utente ${uid}.`);
    }

    // Puoi aggiungere qui altre collezioni da pulire se necessario

    console.log(`[deleteUserData] Pulizia completata per UID: ${uid}`);
  } catch (error) {
    console.error(`[deleteUserData] Errore per UID: ${uid}`, error);
  }
}); 