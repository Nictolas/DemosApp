// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { db } from './firebase-config.js';

// Import necessari da 'firebase/firestore'
import { collection, doc, getDoc, setDoc, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';

// Import dei tipi necessari con percorso corretto
import { Utente, UserOpinions } from './types.js'; // Assumendo types.ts in server/

class UserService extends FirebaseService {

  /**
   * Salva o aggiorna i dati di un utente in Firestore.
   */
  public static async saveUserData(userData: Utente): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!db || !userData.email) return { success: false, error: "DB non configurato o email mancante" };

      const emailId = this.emailToId(userData.email);
      const userDocRef = doc(db, 'utenti', emailId);

      const dataToSave: Utente = { 
        ...userData, 
        id: emailId, // Assicura che l'ID del documento sia nei dati
        updatedAt: new Date().toISOString() 
      };
      if (!dataToSave.createdAt) {
        dataToSave.createdAt = new Date().toISOString();
      }

      await setDoc(userDocRef, dataToSave, { merge: true });
      return { success: true, data: dataToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserData');
    }
  }

  /**
   * Aggiorna parzialmente i dati di un utente.
   */
  public static async updateUserData(email: string, userData: Partial<Utente>): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const emailId = this.emailToId(email);
      const userDocRef = doc(db, 'utenti', emailId);

      const dataToUpdate = { ...userData, updatedAt: new Date().toISOString() };

      await updateDoc(userDocRef, dataToUpdate);
      return { success: true, data: dataToUpdate };
    } catch (error) {
      return this.handleError(error, 'updateUserData');
    }
  }

  /**
   * Recupera un utente dal database tramite la sua email.
   */
  public static async getUserByEmail(email: string): Promise<Utente | null> {
    try {
      if (!db) return null;
      const emailId = this.emailToId(email);
      const userDocRef = doc(db, 'utenti', emailId);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Utente;

      // Fallback per dati non migrati
      const q = query(collection(db, 'utenti'), where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Utente;

      return null;
    } catch (error) {
      this.handleError(error, 'getUserByEmail');
      return null;
    }
  }

  /**
   * Recupera tutti gli utenti dalla collezione.
   */
  public static async getAllUsers(): Promise<Utente[]> {
    try {
      if (!db) return [];
      const snapshot = await getDocs(collection(db, 'utenti'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Utente));
    } catch (error) {
      this.handleError(error, 'getAllUsers');
      return [];
    }
  }

  /**
   * Salva o aggiorna le opinioni di un utente.
   */
  public static async saveUserOpinions(userEmail: string, opinions: UserOpinions): Promise<{ success: boolean; data?: any; error?: string; }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const emailId = this.emailToId(userEmail);
      const userDocRef = doc(db, 'utenti', emailId);
      const opinionsToSave = { ...opinions, updatedAt: new Date().toISOString() };
      await setDoc(userDocRef, opinionsToSave, { merge: true });
      return { success: true, data: opinionsToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserOpinions');
    }
  }

  /**
   * Recupera le opinioni di un utente.
   */
  public static async getUserOpinions(userEmail: string): Promise<UserOpinions | null> {
    const user = await this.getUserByEmail(userEmail);
    if (!user) return null;

    return {
      energia_nucleare: user.energia_nucleare,
      sperimentazione_animale: user.sperimentazione_animale,
      legalizzazione_canapa: user.legalizzazione_canapa,
      caccia: user.caccia,
      unione_europea: user.unione_europea,
    };
  }

  /**
   * Recupera tutti gli utenti con ruolo "Candidato" o "Candidato Politico".
   */
  public static async getCandidati(): Promise<Utente[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => 
      user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico'
    );
  }

  /**
   * Cerca politici per nome e cognome.
   */
  public static async searchPoliticians(searchTerm: string): Promise<Utente[]> {
    const allUsers = await this.getAllUsers();
    const q = searchTerm.toLowerCase();
    return allUsers.filter(user =>
      (user.ruolo === 'Politico' || user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico') &&
      (`${user.nome} ${user.cognome}`.toLowerCase().includes(q))
    );
  }
}

export default UserService;