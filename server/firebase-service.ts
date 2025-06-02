import { db, auth, adminDb, adminAuth } from './firebase-config';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';

// Definizione del tipo per le opinioni degli utenti
export interface UserOpinions {
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  unione_europea?: string;
  utente_id?: string;
  [key: string]: string | undefined;
}

/**
 * Servizio per interagire con Firebase Firestore
 * UTILIZZA ESCLUSIVAMENTE FIREBASE, NESSUNA MEMORIZZAZIONE LOCALE
 */
class FirebaseService {
  static tempOpinions: Record<string, UserOpinions> = {};

  /**
   * Registra un nuovo utente in Firebase Auth
   * Usato per creare l'autenticazione ufficiale su Firebase
   * @param email Email dell'utente
   * @param password Password dell'utente 
   * @param userDetails Dettagli utente completi
   */
  static async registerUserOnFirebaseAuth(email: string, password: string, userDetails: any = {}): Promise<{
    success: boolean;
    user?: any;
    error?: string;
    saveResult?: any;
  }> {
    try {
      console.log(`Tentativo di registrazione utente su Firebase Auth con email: ${email}`);
      
      if (!auth) {
        console.log('Firebase Auth non configurato, impossibile registrare utente');
        return { 
          success: false, 
          error: "Firebase Auth non configurato" 
        };
      }

      // Registra l'utente in Firebase Auth
      console.log('Avvio registrazione utente su Firebase Auth');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user) {
        console.error('Nessun utente restituito dopo la registrazione su Firebase Auth');
        return { 
          success: false, 
          error: "Nessun utente restituito dalla registrazione" 
        };
      }
      
      console.log('Utente registrato con successo su Firebase Auth. UID:', userCredential.user.uid);
      
      // Salva i dati utente in Firestore
      const userDataToSave = {
        email,
        uid: userCredential.user.uid,
        ...userDetails,
        createdAt: new Date().toISOString()
      };
      
      const saveResult = await this.saveUserData(userDataToSave);
      
      return {
        success: true,
        user: userCredential.user,
        saveResult
      };
      
    } catch (error: any) {
      console.error('Errore durante la registrazione su Firebase Auth:', error);
      return { 
        success: false, 
        error: error.message || 'Errore durante la registrazione'
      };
    }
  }

  /**
   * Salva i dati di un nuovo utente in Firebase Firestore nella collezione utenti
   * Usato principalmente durante la registrazione di un nuovo utente
   * @param userData Dati dell'utente da salvare (inclusa l'email)
   */
  static async saveUserData(userData: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    note?: string;
  }> {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile salvare dati');
        return { 
          success: false, 
          error: "Firebase Firestore non è configurato"
        };
      }

      console.log('Salvataggio dati utente in Firestore:', userData);
      
      const usersCollection = collection(db, 'utenti');
      const docRef = await addDoc(usersCollection, userData);
      
      console.log('Dati utente salvati con successo in Firestore con ID:', docRef.id);
      
      return {
        success: true,
        data: { id: docRef.id, ...userData },
        note: "Dati utente salvati correttamente in Firestore"
      };
      
    } catch (error: any) {
      console.error('Errore nel salvare i dati utente in Firestore:', error);
      return { 
        success: false, 
        error: error.message || 'Errore sconosciuto durante il salvataggio'
      };
    }
  }

  /**
   * Recupera un utente dal database tramite email
   */
  static async getUserByEmail(email: string) {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile recuperare dati');
        return null;
      }

      const usersCollection = collection(db, 'utenti');
      const q = query(usersCollection, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const userDoc = querySnapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() };
      
    } catch (error: any) {
      console.error('Errore nel recuperare utente da Firestore:', error);
      return null;
    }
  }

  /**
   * Salva le opinioni dell'utente su Firebase modificando il documento utente
   * @returns {Object} Un oggetto con success (boolean), data (array), note (string opzionale) e error (string o null)
   */
  static async saveUserOpinions(utenteId: string, opinions: UserOpinions): Promise<{
    success: boolean;
    data?: any;
    note?: string;
    error?: string;
  }> {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile salvare opinioni');
        return { 
          success: false, 
          error: "Firebase Firestore non è configurato"
        };
      }

      console.log('Salvataggio opinioni utente in Firestore per ID:', utenteId);
      
      const userDocRef = doc(db, 'utenti', utenteId);
      await setDoc(userDocRef, opinions, { merge: true });
      
      console.log('Opinioni utente salvate con successo in Firestore');
      
      return {
        success: true,
        data: opinions,
        note: "Opinioni utente salvate correttamente in Firestore"
      };
      
    } catch (error: any) {
      console.error('Errore nel salvare le opinioni utente in Firestore:', error);
      return { 
        success: false, 
        error: error.message || 'Errore sconosciuto durante il salvataggio delle opinioni'
      };
    }
  }

  /**
   * Aggiorna i dati di un utente in Firebase
   * @param email Email dell'utente da aggiornare (usata per trovare il documento)
   * @param userData Dati dell'utente da aggiornare
   */
  static async updateUserData(email: string, userData: any) {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile aggiornare dati');
        return { 
          success: false, 
          error: "Firebase Firestore non è configurato"
        };
      }

      // Prima trova l'utente tramite email
      const user = await this.getUserByEmail(email);
      if (!user || !user.id) {
        return {
          success: false,
          error: "Utente non trovato"
        };
      }

      const userDocRef = doc(db, 'utenti', user.id);
      await updateDoc(userDocRef, {
        ...userData,
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        data: userData
      };
      
    } catch (error: any) {
      console.error('Errore nell\'aggiornare i dati utente in Firestore:', error);
      return { 
        success: false, 
        error: error.message || 'Errore sconosciuto durante l\'aggiornamento'
      };
    }
  }

  /**
   * Elimina un utente in Firebase tramite email
   * @returns {Object} Un oggetto con success (boolean) e error (string o undefined)
   */
  static async deleteUserByEmail(email: string): Promise<{
    success: boolean;
    error?: string;
    data?: null; 
  }> {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile eliminare dati');
        return { 
          success: false, 
          error: "Firebase Firestore non è configurato"
        };
      }

      // Prima trova l'utente tramite email
      const user = await this.getUserByEmail(email);
      if (!user || !user.id) {
        return {
          success: false,
          error: "Utente non trovato"
        };
      }

      const userDocRef = doc(db, 'utenti', user.id);
      await deleteDoc(userDocRef);
      
      return { success: true };
    } catch (error: any) {
      console.error('Errore nell\'eliminare utente da Firestore:', error);
      return { 
        success: false, 
        error: error.message || 'Errore sconosciuto durante l\'eliminazione'
      };
    }
  }

  /**
   * Recupera le opinioni dell'utente da Firebase tramite ID utente
   * direttamente dal documento utente
   */
  static async getUserOpinions(utenteId: string): Promise<UserOpinions | null> {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile recuperare opinioni');
        return null;
      }

      const userDocRef = doc(db, 'utenti', utenteId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const userData = userDoc.data();
      
      // Estrai solo i campi delle opinioni
      const opinions: UserOpinions = {
        energia_nucleare: userData.energia_nucleare,
        sperimentazione_animale: userData.sperimentazione_animale,
        legalizzazione_canapa: userData.legalizzazione_canapa,
        caccia: userData.caccia,
        unione_europea: userData.unione_europea,
        utente_id: utenteId
      };
      
      return opinions;
      
    } catch (error: any) {
      console.error('Errore nel recuperare le opinioni utente da Firestore:', error);
      return null;
    }
  }

  /**
   * Recupera le informazioni di tutti gli utenti con le loro opinioni
   */
  static async getAllUsersOpinions(): Promise<any[]> {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile recuperare dati');
        return [];
      }

      const usersCollection = collection(db, 'utenti');
      const querySnapshot = await getDocs(usersCollection);
      
      const users: any[] = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      
      return users;
      
    } catch (error: any) {
      console.error('Errore nel recuperare tutti gli utenti da Firestore:', error);
      return [];
    }
  }

  /**
   * Recupera le opinioni di tutti gli utenti
   */
  static async getAllOpinions(): Promise<any[]> {
    return this.getAllUsersOpinions();
  }
}

export default FirebaseService;