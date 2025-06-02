// Import Firebase e Firestore
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import * as admin from "firebase-admin";

// Configurazione Firebase (usa i tuoi dati)
const firebaseConfig = {
  apiKey: "<REDACTED_GCP_API_KEY>",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.firebasestorage.app",
  messagingSenderId: "848085963511",
  appId: "1:848085963511:web:2efb3d13fb5576ecd0b9f2",
  measurementId: "G-HSP3FK0GFN" // opzionale, per Analytics
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza Firestore
const db = getFirestore(app);

// Inizializza Auth
const auth = getAuth(app);

// Inizializza Firebase Admin (per operazioni server-side)
let adminDb: admin.firestore.Firestore | null = null;
let adminAuth: admin.auth.Auth | null = null;

try {
  // Prova a inizializzare Firebase Admin se non è già stato fatto
  if (!admin.apps.length) {
    // Qui dovresti usare le credenziali del service account
    // Per ora uso la configurazione base, ma dovresti avere un file JSON delle credenziali
    admin.initializeApp({
      projectId: "demos-finale"
    });
  }
  
  adminDb = admin.firestore();
  adminAuth = admin.auth();
  console.log('Firebase Admin inizializzato');
} catch (error) {
  console.error('Errore nell\'inizializzazione di Firebase Admin:', error);
}

// Esporta db per usarlo altrove
export { db, auth, adminDb, adminAuth };