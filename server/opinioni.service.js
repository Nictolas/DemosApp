import { db } from '../api/firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';

class OpinioniService {
  static async listOpinioni() {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'opinioni'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async addOpinione({ id, text }) {
    if (!db) return { success: false, error: 'Database non configurato' };
    // id = chiave interna, text = testo visibile
    await addDoc(collection(db, 'opinioni'), { id, text });
    return { success: true };
  }

  static async deleteOpinione(opinioneId) {
    if (!db) return { success: false, error: 'Database non configurato' };
    // 1. Elimina dalla collection opinioni
    const opinioniRef = collection(db, 'opinioni');
    const q = query(opinioniRef, where('id', '==', opinioneId));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, 'opinioni', d.id));
    }
    // 2. Rimuovi il campo da tutti gli utenti
    const utentiSnap = await getDocs(collection(db, 'utenti'));
    for (const userDoc of utentiSnap.docs) {
      const userData = userDoc.data();
      if (opinioneId in userData) {
        const update = {};
        update[opinioneId] = null;
        await updateDoc(userDoc.ref, update);
      }
    }
    return { success: true };
  }

  static async updateOpinione(opinioneId, newText) {
    if (!db) return { success: false, error: 'Database non configurato' };
    const opinioniRef = collection(db, 'opinioni');
    const q = query(opinioniRef, where('id', '==', opinioneId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: false, error: 'Opinione non trovata' };
    for (const d of snapshot.docs) {
      await updateDoc(doc(db, 'opinioni', d.id), { text: newText });
    }
    return { success: true };
  }
}

export default OpinioniService; 