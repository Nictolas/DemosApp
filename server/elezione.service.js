import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class ElezioneService {

  /**
   * Crea una nuova elezione dopo aver validato i dati.
   */
  static async createElezione(elezioneData) {
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
  static async getAllElezioni() {
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
  static async getElezioneById(id) {
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
  static async updateElezione(id, elezioneData) {
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
  static async deleteElezione(id) {
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