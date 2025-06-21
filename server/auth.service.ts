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
        // Campi obbligatori che abbiamo già
        email,
        uid: userCredential.user.uid,
        status: 'pending',

        // Campi che arrivano da userDetails, con un valore di default se non presenti
        nome: userDetails.nome || '',
        cognome: userDetails.cognome || '',
        data_nascita: userDetails.data_nascita || null,
        genere: userDetails.genere || 'Non specificato',
        cittadinanza: userDetails.cittadinanza || '',

        // Campi di residenza con valori di default
        paese_residenza: userDetails.paese_residenza || '',
        regione_residenza: userDetails.regione_residenza || '',
        provincia_residenza: userDetails.provincia_residenza || '',
        comune_residenza: userDetails.comune_residenza || '',

        // Altri campi che potrebbero essere nel tipo Utente, con valori di default
        // Se non sono obbligatori, puoi rimuoverli
        paese_elezione: userDetails.paese_elezione || null,
        regione_elezione: userDetails.regione_elezione || null,
        provincia_elezione: userDetails.provincia_elezione || null,
        comune_elezione: userDetails.comune_elezione || null,
        paese_candidatura: userDetails.paese_candidatura || null,
        regione_candidatura: userDetails.regione_candidatura || null,
        provincia_candidatura: userDetails.provincia_candidatura || null,
        comune_candidatura: userDetails.comune_candidatura || null,
        ruolo: userDetails.ruolo || 'Elettore',
        grado_elezione: userDetails.grado_elezione || null,
        grado_candidatura: userDetails.grado_candidatura || null,
        energia_nucleare: userDetails.energia_nucleare || null,
        sperimentazione_animale: userDetails.sperimentazione_animale || null,
        legalizzazione_canapa: userDetails.legalizzazione_canapa || null,
        caccia: userDetails.caccia || null,
        unione_europea: userDetails.unione_europea || null
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