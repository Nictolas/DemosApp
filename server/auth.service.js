import FirebaseService from './firebase-service.js';
import { auth, adminDb, adminAuth } from '../api/firebase-config.js';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import UserService from './user.service.js';
import AdminService from './admin.service.js';

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
    try {
      if (!auth) throw new Error("Firebase Auth non inizializzata.");
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Invia email di verifica
      await sendEmailVerification(user);

      // Crea il profilo utente in Firestore con status 'pending'
      const userProfile = {
        uid: user.uid,
        email: user.email,
        ...userDetails,
        created_at: new Date().toISOString(),
        status: 'pending', // Stato iniziale
        ruolo: 'Utente' // Ruolo di default
      };

      await UserService.createUserProfile(user.uid, userProfile);

      // Invia una notifica agli admin
      const notificationData = {
        type: 'new_user_pending',
        title: 'Nuova Richiesta di Registrazione',
        message: `L'utente ${userDetails.nome} ${userDetails.cognome} (${email}) ha richiesto di registrarsi.`,
        userData: {
            uid: user.uid,
            nome: userDetails.nome,
            cognome: userDetails.cognome,
            email: email
        },
        createdAt: new Date().toISOString(),
        read: false
      };
      await AdminService.createAdminNotification(notificationData);

      return { success: true, user };

    } catch (error) {
      return this.handleError(error, 'registerUser');
    }
  }
}

export default AuthService; 