// File stub temporaneo per compatibilità Firebase
// TODO: Sostituire gradualmente con chiamate API

// Oggetti mock per mantenere compatibilità
export const db = {
  collection: () => ({
    getDocs: () => Promise.resolve({ docs: [] }),
    addDoc: () => Promise.resolve({ id: 'mock-id' }),
    where: () => ({}),
  }),
  doc: () => ({
    getDoc: () => Promise.resolve({ exists: () => false, data: () => ({}) }),
    updateDoc: () => Promise.resolve(),
  }),
};

export const auth = {
  currentUser: null,
  signOut: () => Promise.resolve(),
};

// Funzioni Firebase mock
export const collection = () => db.collection();
export const getDocs = () => Promise.resolve({ docs: [] });
export const addDoc = () => Promise.resolve({ id: 'mock-id' });
export const doc = () => db.doc();
export const getDoc = () => Promise.resolve({ exists: () => false, data: () => ({}) });
export const updateDoc = () => Promise.resolve();
export const query = () => ({});
export const where = () => ({});
export const arrayUnion = (val: any) => val;
export const increment = (val: number) => val;
export const arrayRemove = (val: any) => val;
export const deleteDoc = () => Promise.resolve();

// Auth Firebase mock
export const getAuth = () => auth;
export const signInWithEmailAndPassword = () => Promise.resolve({ user: null });
export const sendPasswordResetEmail = () => Promise.resolve();
export const EmailAuthProvider = {
  credential: () => ({}),
};
export const reauthenticateWithCredential = () => Promise.resolve();
export const updatePassword = () => Promise.resolve();

// FCM mock
export const getMessaging = () => ({});
export const getToken = () => Promise.resolve('mock-token');
