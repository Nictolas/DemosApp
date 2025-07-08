import { db } from '../api/firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

class ICEService {
  // Lista tutte le ICE
  static async listICE() {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'ice'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Aggiunge una nuova ICE
  static async addICE({ nome, dataInizio, dataFine, sitoWeb }) {
    if (!db) return { success: false, error: 'Database non configurato' };
    try {
      const docRef = await addDoc(collection(db, 'ice'), {
        nome,
        dataInizio,
        dataFine,
        sitoWeb,
        quorum: 'pending',
        data_creazione: new Date().toISOString(),
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Aggiorna il quorum di una ICE
  static async patchQuorum(id, quorum) {
    if (!db) return { success: false, error: 'Database non configurato' };
    try {
      await updateDoc(doc(db, 'ice', id), { quorum });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Elimina una ICE
  static async deleteICE(id) {
    if (!db) return { success: false, error: 'Database non configurato' };
    try {
      await deleteDoc(doc(db, 'ice', id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default ICEService; 