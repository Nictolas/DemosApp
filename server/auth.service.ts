import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseService } from './firebase-service.js';
import UserService from './user.service.js';
import { Utente } from './types.js';

class AuthService extends FirebaseService {

  /**
   * Registra un nuovo utente e salva i dati iniziali del profilo (primo step).
   */
  public static async registerUser(
    initialUserData: Partial<Utente>
  ): Promise<{ success: boolean; user?: any; error?: string; }> {
    try {
      const { email, password, ...profileData } = initialUserData;
      if (!auth || !email || !password) {
        return { success: false, error: "Email e password sono obbligatori" };
      }

      // 1. Crea l'utente in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user) {
        return { success: false, error: "Creazione utente Firebase fallita" };
      }

      // 2. Prepara l'oggetto completo da salvare su Firestore
      const userDataToSave: Partial<Utente> = {
        email: email,
        uid: user.uid,
        status: 'pending_approval',
        ...profileData,
      };

      // 3. Salva il documento utente iniziale su Firestore
      await UserService.saveUserData(userDataToSave);

      return { success: true, user: user };
    } catch (error) {
      return this.handleError(error, 'registerUser');
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