// Classe base per i servizi Firebase
import { db } from '../api/firebase-config';
import type { Firestore } from 'firebase/firestore';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';

export default class FirebaseService {
  /**
   * Gestione centralizzata degli errori per i servizi.
   */
  static handleError(error: any, context: string) {
    console.error(`[${context}] Errore:`, error);
    return { success: false, error: error?.message || String(error) };
  }

  /**
   * Converte un'email in un ID valido per Firestore (sostituisce caratteri non validi).
   */
  static emailToId(email: string): string {
    return email.replace(/[@.]/g, '_').toLowerCase();
  }

  /**
   * Salva un documento generico in una collezione Firestore.
   * Se il documento ha un campo 'id', lo usa come chiave primaria.
   */
  static async _saveDocument(collectionName: string, data: any): Promise<{ success: boolean; data?: any; error?: string }> {
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

export { FirebaseService }; 