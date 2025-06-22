import FirebaseService from './firebase-service';
import { auth } from '../api/firebase-config';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import UserService from './user.service.js';

class AuthService extends FirebaseService {
  static async registerUserOnFirebaseAuth(email, password, userDetails) {
    try {
      console.log("NUOVA VERSIONE DEL FILE AUTH.SERVICE IN ESECUZIONE:", userDetails);
      if (!auth) return { success: false, error: "Firebase Auth non è configurato" };

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (!userCredential.user) return { success: false, error: "Nessun utente restituito dalla registrazione" };

      const userDataToSave = {
        id: userCredential.user.uid,
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

  static async resetPassword(email) {
    try {
      if (!auth) return { success: false, error: "Firebase Auth non è configurato" };
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'resetPassword');
    }
  }

  static async registerUser(email, password, userDetails) {
    return this.registerUserOnFirebaseAuth(email, password, userDetails);
  }
}

export default AuthService; 