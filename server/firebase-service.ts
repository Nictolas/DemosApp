import { db } from './firebase-config'; // Assicurati che il percorso sia corretto
import { collection, addDoc, getDocs, query, where, limit, deleteDoc } from 'firebase/firestore';
import { ClassificaItem } from './types'; // Importiamo i tipi dal file types.ts

/**
 * Classe base con metodi di utility condivisi per interagire con Firebase.
 * Questa classe viene estesa dagli altri servizi specifici (AuthService, UserService, ecc.).
 */
export class FirebaseService {

  /**
   * Converte un'email in un ID valido per i documenti Firestore.
   * Protetto: accessibile solo da questa classe e dalle classi che la estendono.
   */
  protected static emailToId(email: string): string {
    return email.replace(/[.#$\[\]]/g, '_');
  }

  /**
   * Gestisce in modo centralizzato la cattura degli errori.
   * Protetto: accessibile solo da questa classe e dalle classi che la estendono.
   */
  protected static handleError(error: any, context: string): { success: false; error: string } {
    console.error(`Errore in ${context}:`, error);
    const message = error instanceof Error ? error.message : `Errore sconosciuto in ${context}`;
    return { success: false, error: message };
  }

  // --- Metodi Helper Generici per i servizi figli ---

  protected static async _saveDocument(collectionName: string, data: object): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const dataToSave = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const docRef = await addDoc(collection(db, collectionName), dataToSave);
      return { success: true, data: { id: docRef.id, ...dataToSave } };
    } catch (error) {
      return this.handleError(error, `_saveDocument (${collectionName})`);
    }
  }

  protected static async _registerUserVote(votesCollectionName: string, userId: string, entityName: string, entityKey: string = 'nome'): Promise<{ success: boolean; error?: string }> {
     try {
        if (!db) return { success: false, error: 'Database non configurato' };
        const votiRef = collection(db, votesCollectionName);
        await addDoc(votiRef, { userId, [entityKey]: entityName, timestamp: new Date().toISOString() });
        return { success: true };
    } catch (error) {
        return this.handleError(error, `_registerUserVote (${votesCollectionName})`);
    }
  }

  protected static async _getUserVotes(votesCollectionName: string, userId: string, entityKey: string = 'nome'): Promise<string[]> {
      try {
          if (!db) return [];
          const q = query(collection(db, votesCollectionName), where('userId', '==', userId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => doc.data()[entityKey]);
      } catch (error) {
          this.handleError(error, `_getUserVotes (${votesCollectionName})`);
          return [];
      }
  }

  protected static async _removeUserVote(votesCollectionName: string, userId: string, entityName: string, entityKey: string = 'nome'): Promise<{ success: boolean; error?: string }> {
      try {
          if (!db) return { success: false, error: 'Database non configurato' };
          const q = query(collection(db, votesCollectionName), where('userId', '==', userId), where(entityKey, '==', entityName), limit(1));
          const snapshot = await getDocs(q);
          if (snapshot.empty) return { success: false, error: "Voto non trovato" };
          await deleteDoc(snapshot.docs[0].ref);
          return { success: true };
      } catch (error) {
          return this.handleError(error, `_removeUserVote (${votesCollectionName})`);
      }
  }

  protected static async _getLeaderboard(votesCollectionName: string, entityKey: string = 'nome', resultLimit: number = 10): Promise<ClassificaItem[]> {
    try {
        if (!db) return [];
        const snapshot = await getDocs(collection(db, votesCollectionName));
        const counts: Record<string, number> = {};
        snapshot.forEach((doc) => {
            const entity = doc.data()[entityKey];
            counts[entity] = (counts[entity] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([nome, voti]) => ({ nome, voti }))
            .sort((a, b) => b.voti - a.voti)
            .slice(0, resultLimit);
    } catch (error) {
        this.handleError(error, `_getLeaderboard (${votesCollectionName})`);
        return [];
    }
  }
}