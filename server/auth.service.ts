import { auth } from './firebase-config';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseService } from './firebase-service'; // La nostra classe base
import UserService from './user.service'; // AuthService dipende da UserService
import { Utente } from './types';

class AuthService extends FirebaseService {
  public static async registerUserOnFirebaseAuth(email: string, password: string, userDetails: Omit<Utente, 'email' | 'uid'>): Promise<{ success: boolean; user?: any; error?: string; }> {
    try {
      if (!auth) return { success: false, error: "Firebase Auth non è configurato" };

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (!userCredential.user) return { success: false, error: "Nessun utente restituito" };

      const userDataToSave: Utente = {
        email,
        uid: userCredential.user.uid,
        ...userDetails,
        status: 'pending'
      };

      const saveResult = await UserService.saveUserData(userDataToSave);
      if (!saveResult.success) {
        return { success: false, error: `Utente Auth creato, ma errore salvataggio: ${saveResult.error}` };
      }

      return { success: true, user: userCredential.user };
    } catch (error) {
      return this.handleError(error, 'registerUserOnFirebaseAuth');
    }
  }

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