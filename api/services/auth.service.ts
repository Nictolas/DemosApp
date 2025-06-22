import FirebaseService from './firebase-service';
import { auth } from '../firebase-config';
import { Utente } from '../types';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import UserService from './user.service.js'; // CORRETTO

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
      console.log("NUOVA VERSIONE DEL FILE AUTH.SERVICE IN ESECUZIONE:", userDetails);
      if (!auth) return { success: false, error: "Firebase Auth non è configurato" };

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (!userCredential.user) return { success: false, error: "Nessun utente restituito dalla registrazione" };

      const userDataToSave: Utente = {
        email,
        uid: userCredential.user.uid,
        ...userDetails,
        status: 'pending'
      };

      const saveResult = await UserService.saveUserData(userDataToSave);
      if (!saveResult.success) {
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