import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Configurazione Firebase (usa i tuoi dati)
const firebaseConfig = {
  apiKey: "<REDACTED_GCP_API_KEY>",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.firebasestorage.app",
  messagingSenderId: "848085963511",
  appId: "1:848085963511:web:2efb3d13fb5576ecd0b9f2",
  measurementId: "G-HSP3FK0GFN"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza Firestore e Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Verifica se l'utente è autenticato in Firebase
 * Questo è indipendente dall'autenticazione della sessione Express
 */
export async function checkFirebaseAuth(): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(!!user);
      });
    });
  } catch (error) {
    console.error("Errore verifica autenticazione Firebase:", error);
    return false;
  }
}
