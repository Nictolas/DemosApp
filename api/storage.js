// Importa l'SDK Admin di Firebase
import admin from '../api/firebase-admin.js';

// Collezione Firestore per gli utenti
const utentiCollection = admin.firestore().collection('utenti');

export const storage = {
  // Inserisce un nuovo profilo utente in Firestore
  async insertUser(userData) {
    const docRef = await utentiCollection.add(userData);
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() };
  },

  // Ottiene tutti gli utenti da Firestore
  async getAllUsers() {
    const snapshot = await utentiCollection.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Ottiene un utente per ID Firestore
  async getUserById(id) {
    const doc = await utentiCollection.doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  // Crea un nuovo utente (autenticazione)
  async createUser(data) {
    // Qui puoi eventualmente usare admin.auth().createUser se serve anche su Firebase Auth
    return await this.insertUser(data);
  },

  // Ottiene il profilo utente tramite un campo userId (se presente)
  async getUserProfile(userId) {
    const snapshot = await utentiCollection.where('user_id', '==', userId).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  },
}; 