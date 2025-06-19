import { auth } from './firebase-config.js'; // CORRETTO
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseService } from './firebase-service.js'; // CORRETTO
import UserService from './user.service.js'; // CORRETTO
import { Utente } from './types.js'; // CORRETTO

class AuthService extends FirebaseService {

  /**
   * Registra un nuovo utente in Firebase Auth e chiama UserService per salvare i dati in Firestore.
   */
  public static async registerUser(
    // Accetta tutti i dati del primo form, che sono parziali rispetto al modello Utente finale
    initialUserData: Partial<Utente>
  ): Promise<{ success: boolean; user?: any; error?: string; }> {
    try {
      const { email, password, ...profileData } = initialUserData;
      if (!auth || !email || !password) {
        return { success: false, error: "Email, password e dati del profilo sono obbligatori" };
      }

      // 1. Crea l'utente in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user) {
        return { success: false, error: "Creazione utente Firebase fallita" };
      }

      // 2. Prepara l'oggetto completo da salvare su Firestore
      const userDataToSave: Utente = {
        email: email,
        uid: user.uid,
        status: 'pending_approval', // L'utente è in attesa, ma il profilo base è creato
        ...profileData,
      };

      // 3. Salva il documento utente iniziale su Firestore
      await UserService.saveUserData(userDataToSave);

      return { success: true, user: user };
    } catch (error) {
      return this.handleError(error, 'registerUser');
    }
  }

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