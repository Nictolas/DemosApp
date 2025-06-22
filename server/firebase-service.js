// Classe base per i servizi Firebase
import { db } from '../api/firebase-config';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';

export default class FirebaseService {
  static handleError(error, context) {
    console.error(`[${context}] Errore:`, error);
    return { success: false, error: error?.message || String(error) };
  }

  static async _saveDocument(collectionName, data) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      if (data.id) {
        const ref = doc(db, collectionName, data.id);
        await setDoc(ref, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
        return { success: true, data: { ...data } };
      } else {
        const ref = await addDoc(collection(db, collectionName), { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return { success: true, data: { ...data, id: ref.id } };
      }
    } catch (error) {
      return this.handleError(error, `_saveDocument(${collectionName})`);
    }
  }
} 