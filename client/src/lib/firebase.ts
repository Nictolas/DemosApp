import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getAnalytics, logEvent } from "firebase/analytics";
import { getPerformance } from "firebase/performance";

// Configurazione Firebase (usa i tuoi dati)
const firebaseConfig = {
  apiKey: "AIzaSyA13nlciCI04aVODsrTKwgvr_Y3lp-ozBY",
  authDomain: "demos-finale.firebaseapp.com",
  projectId: "demos-finale",
  storageBucket: "demos-finale.firebasestorage.app",
  messagingSenderId: "848085963511",
  appId: "1:848085963511:web:2efb3d13fb5576ecd0b9f2",
  measurementId: "G-HSP3FK0GFN"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza Analytics, Performance e Crashlytics solo se siamo in ambiente browser
let analytics, perf;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
  perf = getPerformance(app);
}

// Inizializza Firestore e Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

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

export { analytics, perf, logEvent };
