import { FirebaseService } from './firebase-service'; // La nostra classe base
import { db } from './firebase-config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

class ComizioService extends FirebaseService {

  /**
   * Salva un nuovo comizio nel database.
   */
  public static async saveComizio(comizioData: any): Promise<{ success: boolean; data?: any; error?: string }> {
    // Usiamo il metodo helper generico ereditato da FirebaseService
    return this._saveDocument('comizi', comizioData);
  }

  /**
   * Recupera tutti i comizi dal database, ordinati per data.
   */
  public static async getAllComizi(): Promise<any[]> {
    try {
      if (!db) return [];

      const comiziRef = collection(db, 'comizi');
      const q = query(comiziRef, orderBy('quando', 'asc')); // Ordina per data del comizio
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      this.handleError(error, 'getAllComizi');
      return [];
    }
  }
}

export default ComizioService;