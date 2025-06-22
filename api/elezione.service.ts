// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { adminDb } from './firebase-config.js';

// Import necessari da 'firebase/firestore'
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, orderBy, getDoc, query } from 'firebase/firestore';

interface ElezioneData {
  tipo: 'sovranazione' | 'stato' | 'regione' | 'provincia' | 'comune';
  zona: string;
  dataInizio: string; // Può essere una data ISO o un anno come stringa
  dataFine: string;   // Può essere una data ISO o un anno come stringa
  circa: boolean;
}

class ElezioneService extends FirebaseService {

  /**
   * Crea una nuova elezione dopo aver validato i dati.
   */
  public static async createElezione(elezioneData: ElezioneData): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Usiamo il metodo helper generico per salvare il documento
      const result = await this._saveDocument('elezioni', elezioneData);
      if (!result.success || !result.data.id) {
        return { success: false, error: result.error || "ID non restituito dopo il salvataggio" };
      }
      return { success: true, id: result.data.id };
    } catch (error) {
      return this.handleError(error, 'createElezione');
    }
  }

  /**
   * Recupera tutte le elezioni dal database, ordinate per data di creazione decrescente.
   */
  public static async getAllElezioni(): Promise<any[]> {
    try {
      if (!adminDb) return [];
      const querySnapshot = await adminDb.collection('elezioni').orderBy('createdAt', 'desc').get();
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Errore nel recupero delle elezioni:', error);
      return [];
    }
  }

  /**
   * Recupera una singola elezione tramite il suo ID.
   */
  public static async getElezioneById(id: string): Promise<any | null> {
    try {
      if (!adminDb) return null;
      const elezioneDoc = await adminDb.collection('elezioni').doc(id).get();
      if (!elezioneDoc.exists) return null;
      return { id: elezioneDoc.id, ...elezioneDoc.data() };
    } catch (error) {
      console.error('Errore nel recupero elezione:', error);
      return null;
    }
  }

  /**
   * Aggiorna i dati di un'elezione esistente.
   */
  public static async updateElezione(id: string, elezioneData: Partial<any>): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: "Database non configurato" };
      const elezioneDocRef = adminDb.collection('elezioni').doc(id);
      const dataToUpdate = { ...elezioneData, updatedAt: new Date().toISOString() };
      await elezioneDocRef.update(dataToUpdate);
      return { success: true };
    } catch (error) {
      console.error('Errore nell\'aggiornamento elezione:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Elimina un'elezione dal database.
   */
  public static async deleteElezione(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: "Database non configurato" };
      const elezioneDocRef = adminDb.collection('elezioni').doc(id);
      await elezioneDocRef.delete();
      return { success: true };
    } catch (error) {
      console.error('Errore nella cancellazione elezione:', error);
      return { success: false, error: String(error) };
    }
  }
}

export default ElezioneService;