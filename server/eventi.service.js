import FirebaseService from './firebase-service.js';
import { db } from '../api/firebase-config.js';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';

class EventiService extends FirebaseService {
  /**
   * Salva un nuovo evento nel database, aggiungendo informazioni sull'organizzatore.
   * @param eventoData Dati dell'evento dal body della richiesta (es. dove, quando).
   * @param organizer Utente autenticato che sta creando l'evento.
   */
  static async saveEvento(eventoData, organizer) {
    const dataToSave = {
      ...eventoData,
      organizzatore: organizer?.displayName || organizer?.email || 'Sconosciuto',
      createdAt: new Date().toISOString(),
    };
    return this._saveDocument('eventi', dataToSave);
  }

  /**
   * Recupera tutti gli eventi dal database, ordinati per data.
   */
  static async getAllEventi() {
    try {
      if (!db) return [];
      const eventiRef = collection(db, 'eventi');
      const q = query(eventiRef, orderBy('quando', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      this.handleError(error, 'getAllEventi');
      return [];
    }
  }
}
export default EventiService; 