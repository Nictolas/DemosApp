const admin = require("firebase-admin");

// Inizializza Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(), // O usa il tuo file di servizio
});
const db = admin.firestore();

const rappresentanteFields = [
  "rappresentante_europeo",
  "rappresentante_camera",
  "rappresentante_senato",
  "rappresentante_regionale",
  "rappresentante_comunale",
];

async function migrate() {
  const utentiSnapshot = await db.collection("utenti").get();
  const utenti = {};
  utentiSnapshot.forEach(doc => {
    const data = doc.data();
    utenti[doc.id] = { ...data, id: doc.id };
    if (data.email) utenti[data.email] = { ...data, id: doc.id };
  });

  let updatedCount = 0;

  for (const doc of utentiSnapshot.docs) {
    const user = doc.data();
    let updateData = {};
    let needsUpdate = false;

    for (const field of rappresentanteFields) {
      const value = user[field];
      if (value && value !== user.uid && value !== user.id) {
        // Cerca il rappresentante per email o id legacy
        let rappresentante = utenti[value];
        if (!rappresentante && value.includes("@")) {
          // Prova a cercare per email
          rappresentante = utenti[value];
        }
        if (!rappresentante && utenti[value.replace(/[@.]/g, "_")]) {
          // Prova a cercare per id legacy
          rappresentante = utenti[value.replace(/[@.]/g, "_")];
        }
        if (rappresentante && rappresentante.uid) {
          updateData[field] = rappresentante.uid;
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      await db.collection("utenti").doc(doc.id).update(updateData);
      updatedCount++;
      console.log(`Aggiornato utente ${doc.id}:`, updateData);
    }
  }

  console.log(`\nMigrazione completata. Utenti aggiornati: ${updatedCount}`);
}

migrate().catch(console.error); 