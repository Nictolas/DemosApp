// Import della classe base e delle configurazioni con l'estensione .js
import FirebaseService from './firebase-service';
import { db } from '../firebase-config';

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
      if (!db) return [];
      const elezioniCollection = collection(db, 'elezioni');
      const q = query(elezioniCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      this.handleError(error, 'getAllElezioni');
      return [];
    }
  }

  /**
   * Recupera una singola elezione tramite il suo ID.
   */
  public static async getElezioneById(id: string): Promise<any | null> {
    try {
      if (!db) return null;
      const elezioneDoc = doc(db, 'elezioni', id);
      const elezioneSnapshot = await getDoc(elezioneDoc);

      if (elezioneSnapshot.exists()) {
        return { id: elezioneSnapshot.id, ...elezioneSnapshot.data() };
      }
      return null;
    } catch (error) {
      this.handleError(error, 'getElezioneById');
      return null;
    }
  }

  /**
   * Aggiorna i dati di un'elezione esistente.
   */
  public static async updateElezione(id: string, elezioneData: Partial<ElezioneData>): Promise<{ success: boolean; error?: string }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };

      const elezioneDocRef = doc(db, 'elezioni', id);
      const dataToUpdate = {
        ...elezioneData,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(elezioneDocRef, dataToUpdate);
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'updateElezione');
    }
  }

  /**
   * Elimina un'elezione dal database.
   */
  public static async deleteElezione(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const elezioneDocRef = doc(db, 'elezioni', id);
      await deleteDoc(elezioneDocRef);
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'deleteElezione');
    }
  }
}

export default ElezioneService; 