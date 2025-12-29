// Script per impostare i custom claims admin su un utente Firebase
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminClaim(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { ruolo: 'Admin' });
    console.log(`Custom claim 'ruolo: Admin' impostato per l'utente ${uid}`);
  } catch (error) {
    console.error('Errore nell\'impostare il custom claim:', error);
  }
}

// Sostituisci qui con l'UID reale dell'admin
const adminUid = process.argv[2];
if (!adminUid) {
  console.error('Devi passare l\'UID dell\'admin come argomento!');
  process.exit(1);
}
setAdminClaim(adminUid); 