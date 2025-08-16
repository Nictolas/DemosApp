// File stub temporaneo per compatibilità Firebase
// ATTENZIONE: Firebase è disabilitato durante la migrazione
// TODO: Sostituire gradualmente con chiamate API

// Logging per debugging Firebase usage
const logFirebaseUsage = (method: string) => {
  console.warn(`🔥 FIREBASE CALL BLOCKED: ${method} - Migrazione in corso verso API Neon`);
  // Mostra toast solo per chiamate critiche
  if (method.includes('addDoc') || method.includes('updateDoc') || method.includes('deleteDoc')) {
    // Solo avviso console per ora, evitando loop di toast
    console.error(`❌ FIREBASE WRITE OPERATION BLOCKED: ${method}`);
  }
};

// Oggetti mock per mantenere compatibilità
export const db = {
  collection: () => {
    logFirebaseUsage('db.collection');
    return {
      getDocs: () => {
        logFirebaseUsage('collection.getDocs');
        return Promise.resolve({ docs: [] });
      },
      addDoc: () => {
        logFirebaseUsage('collection.addDoc');
        return Promise.resolve({ id: 'mock-id' });
      },
      where: () => {
        logFirebaseUsage('collection.where');
        return {};
      },
    };
  },
  doc: () => {
    logFirebaseUsage('db.doc');
    return {
      getDoc: () => {
        logFirebaseUsage('doc.getDoc');
        return Promise.resolve({ exists: () => false, data: () => ({}) });
      },
      updateDoc: () => {
        logFirebaseUsage('doc.updateDoc');
        return Promise.resolve();
      },
    };
  },
};

export const auth = {
  currentUser: null,
  signOut: () => {
    logFirebaseUsage('auth.signOut');
    return Promise.resolve();
  },
  onAuthStateChanged: () => {
    logFirebaseUsage('auth.onAuthStateChanged');
    return () => {}; // unsubscribe function
  },
};

// Funzioni Firebase mock con logging
export const collection = () => {
  logFirebaseUsage('collection');
  return db.collection();
};
export const getDocs = () => {
  logFirebaseUsage('getDocs');
  return Promise.resolve({ docs: [] });
};
export const addDoc = () => {
  logFirebaseUsage('addDoc');
  return Promise.resolve({ id: 'mock-id' });
};
export const doc = () => {
  logFirebaseUsage('doc');
  return db.doc();
};
export const getDoc = () => {
  logFirebaseUsage('getDoc');
  return Promise.resolve({ exists: () => false, data: () => ({}) });
};
export const updateDoc = () => {
  logFirebaseUsage('updateDoc');
  return Promise.resolve();
};
export const query = () => {
  logFirebaseUsage('query');
  return {};
};
export const where = () => {
  logFirebaseUsage('where');
  return {};
};
export const arrayUnion = (val: any) => {
  logFirebaseUsage('arrayUnion');
  return val;
};
export const increment = (val: number) => {
  logFirebaseUsage('increment');
  return val;
};
export const arrayRemove = (val: any) => {
  logFirebaseUsage('arrayRemove');
  return val;
};
export const deleteDoc = () => {
  logFirebaseUsage('deleteDoc');
  return Promise.resolve();
};

// Auth Firebase mock con logging
export const getAuth = () => {
  logFirebaseUsage('getAuth');
  return auth;
};
export const signInWithEmailAndPassword = () => {
  logFirebaseUsage('signInWithEmailAndPassword');
  return Promise.resolve({ user: null });
};
export const sendPasswordResetEmail = () => {
  logFirebaseUsage('sendPasswordResetEmail');
  return Promise.resolve();
};
export const EmailAuthProvider = {
  credential: () => {
    logFirebaseUsage('EmailAuthProvider.credential');
    return {};
  },
};
export const reauthenticateWithCredential = () => {
  logFirebaseUsage('reauthenticateWithCredential');
  return Promise.resolve();
};
export const updatePassword = () => {
  logFirebaseUsage('updatePassword');
  return Promise.resolve();
};

// FCM mock
export const getMessaging = () => ({});
export const getToken = () => Promise.resolve('mock-token');
