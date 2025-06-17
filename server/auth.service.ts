import { auth } from './firebase-config.js'; // CORRETTO
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseService } from './firebase-service.js'; // CORRETTO
import UserService from './user.service.js'; // CORRETTO
import { Utente } from './types.js'; // CORRETTO

class AuthService extends FirebaseService {

  /**
   * Registra un nuovo utente in Firebase Auth e chiama UserService per salvare i dati in Firestore.
   */
  public static async registerUserOnFirebaseAuth(
    email: string,
    password: string,
    userDetails: Omit<Utente, 'email' | 'uid' | 'id'>
  ): Promise<{ success: boolean; user?: any; error?: string; }> {
    try {
      // ▼▼▼ AGGIUNGI QUESTA RIGA ESATTA ▼▼▼
      console.log("NUOVA VERSIONE DEL FILE AUTH.SERVICE IN ESECUZIONE:", userDetails);
      // ▲▲▲ FINE DELLA RIGA DA AGGIUNGERE ▲▲▲
      if (!auth) return { success: false, error: "Firebase Auth non è configurato" };

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (!userCredential.user) return { success: false, error: "Nessun utente restituito dalla registrazione" };

      const userDataToSave: Utente = {
        email,
        uid: userCredential.user.uid,
        ...userDetails,
        status: 'pending'
      };

      // Delega il salvataggio dei dati a UserService
      const saveResult = await UserService.saveUserData(userDataToSave);
      if (!saveResult.success) {
        // Qui si potrebbe implementare una logica di rollback per cancellare l'utente da Auth
        // se il salvataggio su Firestore fallisce, ma per ora lo segnaliamo.
        return { success: false, error: `Utente Auth creato, ma errore nel salvataggio dei dati: ${saveResult.error}` };
      }

      return { success: true, user: userCredential.user };
    } catch (error) {
      return this.handleError(error, 'registerUserOnFirebaseAuth');
    }
  }

  /**
   * Invia un'email per il reset della password tramite Firebase Auth.
   */
  public static async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!auth) return { success: false, error: "Firebase Auth non è configurato" };
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'resetPassword');
    }
  }
}

export default AuthService;