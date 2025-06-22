// Import della classe base e delle configurazioni con l'estensione .js
import FirebaseService from './firebase-service';
import { db } from '../firebase-config';

// Import necessari da 'firebase/firestore'
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

class ComizioService extends FirebaseService {

  /**
   * Salva un nuovo comizio nel database, aggiungendo informazioni sull'organizzatore.
   * @param comizioData Dati del comizio dal body della richiesta (es. dove, quando).
   * @param organizer Utente autenticato che sta creando il comizio.
   */
  public static async saveComizio(
    comizioData: { dove: string; quando: string },
    organizer: Express.User
  ): Promise<{ success: boolean; data?: any; error?: string }> {

    const dataToSave = {
        ...comizioData,
        organizzatore_id: organizer.uid,
        organizzatore_nome: `${organizer.nome} ${organizer.cognome}`,
        organizzatore_email: organizer.email,
    };

    // Usiamo il metodo helper generico ereditato da FirebaseService
    return this._saveDocument('comizi', dataToSave);
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