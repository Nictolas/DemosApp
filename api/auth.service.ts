import { adminAuth } from './firebase-config.js';
import { FirebaseService } from './firebase-service.js';
import UserService from './user.service.js';
import { Utente } from './types.js';

class AuthService extends FirebaseService {
  public static async registerUser(email: string, password: string, userDetails: Partial<Utente>): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!adminAuth) return { success: false, error: "Firebase Auth non è configurato" };
      const userRecord = await adminAuth.createUser({
        email: email,
        password: password,
        displayName: `${userDetails.nome} ${userDetails.cognome}`,
        emailVerified: false
      });
      if (!userRecord) return { success: false, error: "Nessun utente restituito dalla registrazione" };
      const userData: Utente = {
        id: userRecord.uid,
        uid: userRecord.uid,
        email: userRecord.email!,
        nome: userDetails.nome || '',
        cognome: userDetails.cognome || '',
        ruolo: userDetails.ruolo || 'Elettore',
        genere: userDetails.genere || 'Non specificato',
        data_nascita: userDetails.data_nascita || '',
        regione_residenza: userDetails.regione_residenza || '',
        citta_residenza: userDetails.citta_residenza || '',
        telefono: userDetails.telefono || '',
        bio: userDetails.bio || '',
        avatar_url: userDetails.avatar_url || '',
        is_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const saveResult = await UserService.saveUserData(userData);
      if (!saveResult.success) {
        await adminAuth.deleteUser(userRecord.uid);
        return { success: false, error: saveResult.error };
      }
      return { success: true, data: userData };
    } catch (error) {
      return this.handleError(error, 'registerUser');
    }
  }

  public static async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminAuth) return { success: false, error: "Firebase Auth non è configurato" };
      const actionCodeSettings = {
        url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/reset-password`,
        handleCodeInApp: true
      };
      await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'resetPassword');
    }
  }
}

export default AuthService;