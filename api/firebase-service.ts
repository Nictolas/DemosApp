// Import corretti con estensione .js
import { adminDb } from './firebase-config.js';
import { ClassificaItem } from './types.js';

// Import necessari da Firestore, INCLUSA la funzione di aggregazione 'getCountFromServer'
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  deleteDoc,
  getCountFromServer 
} from 'firebase/firestore';

/**
 * Classe base con metodi di utility condivisi per interagire con Firebase.
 */
export class FirebaseService {

  protected static emailToId(email: string): string {
    return email.replace(/[.#$\[\]]/g, '_');
  }

  protected static handleError(error: any, methodName: string): { success: false; error: string } {
    console.error(`Errore in ${methodName}:`, error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }

  // --- Metodi Helper Generici (invariati) ---

  protected static async _saveDocument(collectionName: string, data: object): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: 'Database non configurato' };
      const dataToSave = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const docRef = await adminDb.collection(collectionName).add(dataToSave);
      return { success: true, data: { id: docRef.id, ...dataToSave } };
    } catch (error) {
      return { success: false, error: `Errore nel salvataggio: ${error}` };
    }
  }

  protected static async _registerUserVote(votesCollectionName: string, userId: string, entityName: string, entityKey: string = 'nome'): Promise<{ success: boolean; error?: string }> {
     try {
       if (!adminDb) return { success: false, error: 'Database non configurato' };
       await adminDb.collection(votesCollectionName).add({ userId, [entityKey]: entityName, timestamp: new Date().toISOString() });
       return { success: true };
     } catch (error) {
       return { success: false, error: `Errore nella registrazione del voto: ${error}` };
     }
  }

  protected static async _getUserVotes(votesCollectionName: string, userId: string, entityKey: string = 'nome'): Promise<string[]> {
      try {
        if (!adminDb) return [];
        const q = adminDb.collection(votesCollectionName).where('userId', '==', userId);
        const snapshot = await q.get();
        return snapshot.docs.map(doc => doc.data()[entityKey]);
      } catch (error) {
        console.error(`Errore nel recupero dei voti: ${error}`);
        return [];
      }
  }

  protected static async _removeUserVote(votesCollectionName: string, userId: string, entityName: string, entityKey: string = 'nome'): Promise<{ success: boolean; error?: string }> {
      try {
        if (!adminDb) return { success: false, error: 'Database non configurato' };
        const q = adminDb.collection(votesCollectionName).where('userId', '==', userId).where(entityKey, '==', entityName).limit(1);
        const snapshot = await q.get();
        if (snapshot.empty) return { success: false, error: "Voto non trovato" };
        await snapshot.docs[0].ref.delete();
        return { success: true };
      } catch (error) {
        return { success: false, error: `Errore nella rimozione del voto: ${error}` };
      }
  }

  /**
   * Calcola la classifica per una data collezione di voti.
   * === VERSIONE OTTIMIZZATA PER PREVENIRE I TIMEOUT SU VERCEL ===
   */
  protected static async _getLeaderboard(votesCollectionName: string, entityKey: string = 'nome', resultLimit: number = 10): Promise<ClassificaItem[]> {
    try {
      const db = adminDb;
      if (!db) {
        console.warn('Database non configurato per _getLeaderboard');
        return [];
      }
      console.log(`[PERFORMANCE] Inizio _getLeaderboard ottimizzato per: ${votesCollectionName}`);

      // Step 1: Ottieni la lista di tutti i nomi unici dei candidati/entità votate.
      const snapshot = await db.collection(votesCollectionName).get();
      const allEntityNames = snapshot.docs.map(doc => doc.data()[entityKey]);
      const uniqueEntityNames = [...new Set(allEntityNames)];

      // Step 2: Per ogni nome unico, esegui una query di CONTEGGIO (molto veloce).
      const countPromises = uniqueEntityNames.map(name => {
        const q = db.collection(votesCollectionName).where(entityKey, '==', name);
        return q.get().then(querySnapshot => ({
          nome: name,
          voti: querySnapshot.size
        }));
      });

      const results = await Promise.all(countPromises);
      const sortedResults = results.sort((a, b) => b.voti - a.voti);
      const limitedResults = sortedResults.slice(0, resultLimit);

      console.log(`[PERFORMANCE] Fine _getLeaderboard per: ${votesCollectionName}. Risultati: ${limitedResults.length}`);
      return limitedResults;
    } catch (error) {
      console.error(`Errore nel recupero della classifica: ${error}`);
      return [];
    }
  }
}