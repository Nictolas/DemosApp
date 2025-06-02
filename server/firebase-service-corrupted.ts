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
   * Usa l'email come ID del documento per evitare duplicazioni
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

      if (!userData.email) {
        return { 
          success: false, 
          error: "Email mancante nei dati utente"
        };
      }

      console.log('Salvataggio dati utente in Firestore con email come ID:', userData.email);
      
      // Usa l'email come ID del documento per evitare duplicazioni
      const emailId = userData.email.replace(/[.#$\[\]]/g, '_'); // Sostituisce caratteri non validi per Firebase
      const userDocRef = doc(db, 'utenti', emailId);
      
      // Aggiungi ID documento ai dati
      const dataToSave = {
        ...userData,
        id: emailId,
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(userDocRef, dataToSave, { merge: true });
      
      console.log('Dati utente salvati con successo in Firestore con ID:', emailId);
      
      return {
        success: true,
        data: dataToSave,
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
   * Usa l'email come ID del documento per accesso diretto
   */
  static async getUserByEmail(email: string) {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile recuperare dati');
        return null;
      }

      // Prima prova con l'email come ID del documento
      const emailId = email.replace(/[.#$\[\]]/g, '_');
      const userDocRef = doc(db, 'utenti', emailId);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      
      // Se non trova il documento con email come ID, cerca con query (backward compatibility)
      const usersCollection = collection(db, 'utenti');
      const q = query(usersCollection, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      // Se ci sono più documenti per la stessa email, unisci tutti i dati
      let mergedData: any = {};
      let primaryDocId = '';
      
      querySnapshot.docs.forEach((doc) => {
        const docData = doc.data();
        // Privilegia il documento con più campi (dati completi del profilo)
        if (Object.keys(docData).length > Object.keys(mergedData).length) {
          primaryDocId = doc.id;
        }
        // Unisce tutti i dati disponibili
        mergedData = { ...mergedData, ...docData };
      });
      
      return { id: primaryDocId || querySnapshot.docs[0].id, ...mergedData };
      
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

      // Se utenteId è un'email, usala direttamente, altrimenti cerca l'utente
      let emailId = utenteId;
      if (utenteId.includes('@')) {
        emailId = utenteId.replace(/[.#$\[\]]/g, '_');
      } else {
        // Se non è un'email, cerca nel database l'utente con questo ID
        const usersCollection = collection(db, 'utenti');
        const querySnapshot = await getDocs(usersCollection);
        let userFound = false;
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.uid === utenteId || userData.id === utenteId) {
            emailId = doc.id;
            userFound = true;
          }
        });
        
        if (!userFound && opinions.email) {
          // Usa l'email dalle opinioni se disponibile
          emailId = opinions.email.replace(/[.#$\[\]]/g, '_');
        }
      }

      console.log('Salvataggio opinioni utente in Firestore per email ID:', emailId);
      
      const userDocRef = doc(db, 'utenti', emailId);
      
      // Aggiungi timestamp di aggiornamento
      const opinionsToSave = {
        ...opinions,
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(userDocRef, opinionsToSave, { merge: true });
      
      console.log('Opinioni utente salvate con successo in Firestore');
      
      return {
        success: true,
        data: opinionsToSave,
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

      // Usa l'email come ID del documento
      const emailId = email.replace(/[.#$\[\]]/g, '_');
      const userDocRef = doc(db, 'utenti', emailId);
      
      // Aggiungi timestamp di aggiornamento
      const dataToUpdate = {
        ...userData,
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(userDocRef, dataToUpdate, { merge: true });
      
      return {
        success: true,
        data: dataToUpdate
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

  /**
   * Invia email di reset password tramite Firebase Auth
   */
  static async resetPassword(email: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!auth) {
        return {
          success: false,
          error: 'Firebase Auth non configurato'
        };
      }

      // Importa sendPasswordResetEmail dinamicamente
      const { sendPasswordResetEmail } = await import('firebase/auth');
      
      await sendPasswordResetEmail(auth, email);
      
      return {
        success: true
      };
      
    } catch (error: any) {
      console.error('Errore nel reset password:', error);
      return {
        success: false,
        error: error.message || 'Errore nel reset password'
      };
    }
  }
}

export default FirebaseService;