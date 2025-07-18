const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.deleteUserData = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const db = admin.firestore();

  // Elimina il documento profilo utente
  await db.collection("utenti").doc(uid).delete();

  // Elimina tutte le opinioni dell’utente
  const opinioniSnap = await db.collection("opinioni").where("uid", "==", uid).get();
  const batch = db.batch();
  opinioniSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // Puoi aggiungere qui altre collezioni da pulire se necessario

  console.log(`Dati utente ${uid} eliminati da Firestore`);
}); 