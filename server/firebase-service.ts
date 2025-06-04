import { db, auth } from './firebase-config';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc, 
  query, 
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';

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
 * Usa l'email come ID del documento per evitare duplicazioni
 */
class FirebaseService {
  static tempOpinions: Record<string, UserOpinions> = {};

  /**
   * Converte email in ID valido per Firebase
   */
  private static emailToId(email: string): string {
    return email.replace(/[.#$\[\]]/g, '_');
  }

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
      if (!auth) {
        console.log('Firebase Auth non configurato');
        return { 
          success: false, 
          error: "Firebase Auth non è configurato" 
        };
      }

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        error: error.message || 'Errore sconosciuto durante la registrazione'
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
      const emailId = this.emailToId(userData.email);
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
      const emailId = this.emailToId(email);
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
   * Usa l'email come ID del documento per mantenere coerenza
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
        emailId = this.emailToId(utenteId);
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
          emailId = this.emailToId(opinions.email);
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
      const emailId = this.emailToId(email);
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
  }> {
    try {
      if (!db) {
        console.log('Firebase Firestore non configurato, impossibile eliminare dati');
        return { 
          success: false, 
          error: "Firebase Firestore non è configurato"
        };
      }

      const emailId = this.emailToId(email);
      const userDocRef = doc(db, 'utenti', emailId);
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
        console.log('Firebase Firestore non configurato');
        return null;
      }

      const userDocRef = doc(db, 'utenti', utenteId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      
      const opinions: UserOpinions = {
        energia_nucleare: userData.energia_nucleare || '',
        sperimentazione_animale: userData.sperimentazione_animale || '',
        legalizzazione_canapa: userData.legalizzazione_canapa || '',
        caccia: userData.caccia || '',
        unione_europea: userData.unione_europea || ''
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
          error: "Firebase Auth non è configurato"
        };
      }

      await sendPasswordResetEmail(auth, email);
      
      return {
        success: true
      };
      
    } catch (error: any) {
      console.error('Errore nel reset password:', error);
      return { 
        success: false, 
        error: error.message || 'Errore sconosciuto durante il reset password'
      };
    }
  }

  // ===== COMUNICAZIONI METHODS =====

  /**
   * Controlla se esiste già una comunicazione con lo stesso titolo e zona
   */
  static async checkDuplicateComunicazione(titolo: string, zona: string) {
    try {
      if (!db) {
        throw new Error("Firebase Firestore non è configurato");
      }

      const comunicazioniCollection = collection(db, 'comunicazioni');
      const q = query(
        comunicazioniCollection,
        where('titolo', '==', titolo),
        where('zona', '==', zona),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          titolo: data.titolo,
          vincitore: data.vincitore,
          zona: data.zona
        };
      }
      
      return null;
    } catch (error: any) {
      console.error('Errore nel controllo duplicati comunicazione:', error);
      throw error;
    }
  }

  /**
   * Elimina una comunicazione precedente dello stesso utente
   */
  static async deletePreviousComunicazione(userId: string): Promise<{
    success: boolean;
    deletedComunicazioneId?: string;
    error?: string;
  }> {
    try {
      if (!db) {
        return { success: false, error: "Firebase Firestore non è configurato" };
      }

      const comunicazioniCollection = collection(db, 'comunicazioni');
      const q = query(
        comunicazioniCollection,
        where('id_utente', '==', userId),
        orderBy('data_creazione', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docToDelete = querySnapshot.docs[0];
        const comunicazioneId = docToDelete.id;
        
        console.log(`🗑️ Eliminando comunicazione precedente: ${comunicazioneId}`);
        
        // Elimina la comunicazione
        await deleteDoc(doc(db, 'comunicazioni', comunicazioneId));
        
        // Elimina tutte le notifiche associate
        await this.deleteNotificationsForComunicazione(comunicazioneId);
        
        return { 
          success: true, 
          deletedComunicazioneId: comunicazioneId 
        };
      }
      
      return { success: true }; // Nessuna comunicazione precedente da eliminare
    } catch (error: any) {
      console.error('Errore eliminazione comunicazione precedente:', error);
      return { 
        success: false, 
        error: error.message || 'Errore sconosciuto nell\'eliminazione comunicazione precedente' 
      };
    }
  }

  /**
   * Elimina tutte le notifiche associate a una comunicazione
   */
  static async deleteNotificationsForComunicazione(comunicazioneId: string): Promise<void> {
    try {
      if (!db) {
        console.error("Firebase Firestore non è configurato");
        return;
      }

      const notificheCollection = collection(db, 'notifiche');
      const q = query(
        notificheCollection,
        where('comunicazione_id', '==', comunicazioneId)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises: Promise<any>[] = [];
      
      console.log(`🗑️ Eliminando ${querySnapshot.size} notifiche per comunicazione ${comunicazioneId}`);
      
      querySnapshot.forEach((notificaDoc) => {
        deletePromises.push(deleteDoc(doc(db, 'notifiche', notificaDoc.id)));
      });
      
      await Promise.all(deletePromises);
      
    } catch (error: any) {
      console.error('Errore nell\'eliminazione notifiche:', error);
    }
  }

  /**
   * Salva una nuova comunicazione nella collezione comunicazioni
   */
  static async saveComunicazione(comunicazioneData: any): Promise<{
    success: boolean;
    data?: any;
    comunicazioneId?: string;
    error?: string;
  }> {
    try {
      if (!db) {
        return {
          success: false,
          error: "Firebase Firestore non è configurato"
        };
      }

      const comunicazioniCollection = collection(db, 'comunicazioni');
      const docRef = await addDoc(comunicazioniCollection, comunicazioneData);
      
      return {
        success: true,
        data: { id: docRef.id, ...comunicazioneData },
        comunicazioneId: docRef.id
      };
    } catch (error: any) {
      console.error('Errore nel salvataggio comunicazione:', error);
      return {
        success: false,
        error: error.message || 'Errore sconosciuto nel salvataggio comunicazione'
      };
    }
  }

  /**
   * Aggiorna l'ultima comunicazione nel documento utente
   */
  static async updateUltimaComunicazione(email: string, ultimaComunicazione: any): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!db) {
        return {
          success: false,
          error: "Firebase Firestore non è configurato"
        };
      }

      const userId = this.emailToId(email);
      const userDoc = doc(db, 'utenti', userId);
      
      await updateDoc(userDoc, {
        ultimaComunicazione,
        updatedAt: new Date().toISOString()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Errore aggiornamento ultima comunicazione:', error);
      return {
        success: false,
        error: error.message || 'Errore sconosciuto nell\'aggiornamento ultima comunicazione'
      };
    }
  }

  /**
   * Recupera la classifica del podio trasparenza
   */
  static async getPodioTrasparenza(): Promise<any[]> {
    try {
      if (!db) {
        return [];
      }

      const comunicazioniCollection = collection(db, 'comunicazioni');
      const querySnapshot = await getDocs(comunicazioniCollection);
      
      // Raggruppa per id_utente e calcola i punti totali
      const userPoints: { [key: string]: any } = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.id_utente;
        
        if (!userPoints[userId]) {
          userPoints[userId] = {
            id_utente: userId,
            nome: data.nome,
            cognome: data.cognome,
            ruolo: data.ruolo,
            punti_trasparenza_totali: 0,
            numero_comunicazioni: 0
          };
        }
        
        userPoints[userId].punti_trasparenza_totali += data.punti_trasparenza || 0;
        userPoints[userId].numero_comunicazioni += 1;
      });
      
      // Converte in array e ordina per punti decrescenti
      const podioArray = Object.values(userPoints)
        .sort((a: any, b: any) => b.punti_trasparenza_totali - a.punti_trasparenza_totali)
        .slice(0, 10); // Top 10
      
      return podioArray;
    } catch (error: any) {
      console.error('Errore nel recupero podio trasparenza:', error);
      return [];
    }
  }

  // ===== NOTIFICHE METHODS =====

  /**
   * Invia notifiche agli utenti che hanno scelto questo rappresentante
   */
  static async sendNotificationsForComunicazione(
    rappresentanteId: string,
    rappresentanteNome: string,
    rappresentanteCognome: string,
    titolo: string,
    votoDato: string,
    commento: string,
    vincitore: string,
    comunicazioneId: string
  ): Promise<void> {
    try {
      if (!db) {
        console.error("Firebase Firestore non è configurato");
        return;
      }

      // Trova tutti gli utenti che hanno scelto questo rappresentante
      const usersCollection = collection(db, 'utenti');
      const usersSnapshot = await getDocs(usersCollection);
      
      const notificationsCollection = collection(db, 'notifiche');
      const notificationPromises: Promise<any>[] = [];
      
      // Ottieni l'email del rappresentante per confronto in formato Firebase
      const rappresentanteEmailFirebase = rappresentanteId.replace('@gmail.com', '@gmail_com');
      
      console.log(`Cercando utenti che hanno scelto rappresentante: ${rappresentanteId} (formato Firebase: ${rappresentanteEmailFirebase})`);
      
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        
        // Debug: mostra i rappresentanti di ogni utente
        console.log(`Utente: ${userData.nome} ${userData.cognome} (${userData.email})`);
        console.log(`  - rappresentante_comunale: ${userData.rappresentante_comunale}`);
        console.log(`  - rappresentante_europeo: ${userData.rappresentante_europeo}`);
        
        // Verifica se l'utente ha scelto questo rappresentante in uno dei campi
        const hasChosenRepresentative = 
          userData.rappresentante_europeo === rappresentanteEmailFirebase ||
          userData.rappresentante_camera === rappresentanteEmailFirebase ||
          userData.rappresentante_senato === rappresentanteEmailFirebase ||
          userData.rappresentante_regionale === rappresentanteEmailFirebase ||
          userData.rappresentante_comunale === rappresentanteEmailFirebase;
        
        if (hasChosenRepresentative) {
          console.log(`✅ Trovato utente che ha scelto questo rappresentante: ${userData.nome} ${userData.cognome} (${userData.email})`);
        }
        
        // Crea notifica solo per utenti che hanno scelto questo rappresentante
        if (hasChosenRepresentative) {
          const notificationData = {
            comunicazione_id: comunicazioneId,
            destinatario_id: userData.uid || userData.id || userDoc.id,
            rappresentante_id: rappresentanteId,
            rappresentante_nome: rappresentanteNome,
            rappresentante_cognome: rappresentanteCognome,
            titolo,
            voto_dato: votoDato,
            commento: commento || "",
            vincitore,
            data_creazione: new Date().toISOString(),
            letta: false
          };
          
          notificationPromises.push(addDoc(notificationsCollection, notificationData));
        }
      });
      
      await Promise.all(notificationPromises);
      console.log(`Inviate ${notificationPromises.length} notifiche per la comunicazione`);
      
    } catch (error: any) {
      console.error('Errore nell\'invio notifiche:', error);
    }
  }

  /**
   * Recupera le notifiche per un utente
   */
  static async getUserNotifications(userId: string): Promise<any[]> {
    try {
      if (!db) {
        return [];
      }

      const notificationsCollection = collection(db, 'notifiche');
      const q = query(
        notificationsCollection,
        where('destinatario_id', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      const notifications: any[] = [];
      
      // Processa le notifiche e ordina manualmente
      for (const docSnapshot of querySnapshot.docs) {
        const notificationData = { id: docSnapshot.id, ...docSnapshot.data() };
        notifications.push(notificationData);
      }
      
      // Ordina manualmente per data_creazione (desc)
      notifications.sort((a, b) => {
        const dateA = new Date(a.data_creazione || 0);
        const dateB = new Date(b.data_creazione || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      return notifications;
    } catch (error: any) {
      console.error('Errore nel recupero notifiche utente:', error);
      return [];
    }
  }

  /**
   * Segna una notifica come letta
   */
  static async markNotificationAsRead(notificationId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!db) {
        return {
          success: false,
          error: "Firebase Firestore non è configurato"
        };
      }

      const notificationDoc = doc(db, 'notifiche', notificationId);
      const notificationSnapshot = await getDoc(notificationDoc);
      
      if (!notificationSnapshot.exists()) {
        return {
          success: false,
          error: "Notifica non trovata"
        };
      }
      
      const notificationData = notificationSnapshot.data();
      if (notificationData.destinatario_id !== userId) {
        return {
          success: false,
          error: "Non autorizzato a modificare questa notifica"
        };
      }
      
      await updateDoc(notificationDoc, {
        letta: true,
        data_lettura: new Date().toISOString()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Errore nel segnare notifica come letta:', error);
      return {
        success: false,
        error: error.message || 'Errore sconosciuto'
      };
    }
  }

  /**
   * Registra una reazione (like/dislike) a una comunicazione
   */
  static async reactToComunicazione(
    comunicazioneId: string,
    userId: string,
    reaction: 'like' | 'dislike'
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      if (!db) {
        return {
          success: false,
          error: "Firebase Firestore non è configurato"
        };
      }

      // Controlla se l'utente ha già reagito
      const reactionsCollection = collection(db, 'reazioni');
      const existingReactionQuery = query(
        reactionsCollection,
        where('comunicazione_id', '==', comunicazioneId),
        where('utente_id', '==', userId),
        limit(1)
      );
      
      const existingReactionSnapshot = await getDocs(existingReactionQuery);
      
      if (!existingReactionSnapshot.empty) {
        // Aggiorna la reazione esistente
        const reactionDoc = existingReactionSnapshot.docs[0];
        await updateDoc(reactionDoc.ref, {
          tipo: reaction,
          data_aggiornamento: new Date().toISOString()
        });
      } else {
        // Crea una nuova reazione
        const reactionData = {
          comunicazione_id: comunicazioneId,
          utente_id: userId,
          tipo: reaction,
          data_creazione: new Date().toISOString()
        };
        
        await addDoc(reactionsCollection, reactionData);
      }
      
      // Aggiorna i contatori nella comunicazione
      const comunicazioneDoc = doc(db, 'comunicazioni', comunicazioneId);
      const comunicazioneSnapshot = await getDoc(comunicazioneDoc);
      
      if (comunicazioneSnapshot.exists()) {
        // Riconteggia likes e dislikes
        const likesQuery = query(
          reactionsCollection,
          where('comunicazione_id', '==', comunicazioneId),
          where('tipo', '==', 'like')
        );
        
        const dislikesQuery = query(
          reactionsCollection,
          where('comunicazione_id', '==', comunicazioneId),
          where('tipo', '==', 'dislike')
        );
        
        const [likesSnapshot, dislikesSnapshot] = await Promise.all([
          getDocs(likesQuery),
          getDocs(dislikesQuery)
        ]);
        
        await updateDoc(comunicazioneDoc, {
          likes: likesSnapshot.size,
          dislikes: dislikesSnapshot.size,
          updatedAt: new Date().toISOString()
        });
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Errore nella reazione alla comunicazione:', error);
      return {
        success: false,
        error: error.message || 'Errore sconosciuto nella reazione'
      };
    }
  }
}

export default FirebaseService;