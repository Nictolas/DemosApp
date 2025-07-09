// Script per impostare i custom claims admin su un utente Firebase
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const auth = getAuth();

async function setAdminClaim(uid) {
  try {
    await auth.setCustomUserClaims(uid, { role: 'Admin', ruolo: 'Admin' });
    console.log(`Custom claim admin impostato per l'utente ${uid}`);
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