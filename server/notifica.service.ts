import { FirebaseService } from './firebase-service'; // La nostra classe base
import { db } from './firebase-config';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore';

class NotificaService extends FirebaseService {

  /**
   * Invia notifiche a tutti gli utenti che hanno scelto un rappresentante specifico.
   */
  public static async sendNotificationsForComunicazione(
    rappresentanteEmail: string,
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
        console.error("Firebase Firestore non è configurato per inviare notifiche.");
        return;
      }

      const rappresentanteIdFirebase = this.emailToId(rappresentanteEmail);
      const usersSnapshot = await getDocs(collection(db, 'utenti'));
      const notificationPromises: Promise<any>[] = [];

      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const rappresentantiScelti = [
            userData.rappresentante_europeo,
            userData.rappresentante_camera,
            userData.rappresentante_senato,
            userData.rappresentante_regionale,
            userData.rappresentante_comunale
        ].filter(Boolean); // Rimuove valori nulli o undefined

        if (rappresentantiScelti.includes(rappresentanteIdFirebase)) {
          const notificationData = {
            comunicazione_id: comunicazioneId,
            destinatario_id: userData.uid || userDoc.id,
            rappresentante_id: rappresentanteIdFirebase,
            rappresentante_nome: rappresentanteNome,
            rappresentante_cognome: rappresentanteCognome,
            titolo,
            voto_dato: votoDato,
            commento: commento || "",
            vincitore,
            data_creazione: new Date().toISOString(),
            letta: false
          };
          notificationPromises.push(addDoc(collection(db, 'notifiche'), notificationData));
        }
      });

      await Promise.all(notificationPromises);
      console.log(`Inviate ${notificationPromises.length} notifiche.`);
    } catch (error) {
      this.handleError(error, 'sendNotificationsForComunicazione');
    }
  }

  /**
   * Recupera tutte le notifiche per un utente specifico, ordinate per data.
   */
  public static async getUserNotifications(userId: string): Promise<any[]> {
    try {
      if (!db) return [];
      const q = query(collection(db, 'notifiche'), where('destinatario_id', '==', userId));
      const querySnapshot = await getDocs(q);

      const notifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Ordina per data decrescente
      notifications.sort((a, b) => 
        new Date(b.data_creazione).getTime() - new Date(a.data_creazione).getTime()
      );

      return notifications;
    } catch (error) {
      this.handleError(error, 'getUserNotifications');
      return [];
    }
  }

  /**
   * Segna una specifica notifica come letta.
   */
  public static async markNotificationAsRead(notificationId: string, userId: string): Promise<{ success: boolean; error?: string; }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };

      const notificationDocRef = doc(db, 'notifiche', notificationId);
      const notificationSnapshot = await getDoc(notificationDocRef);

      if (!notificationSnapshot.exists()) {
        return { success: false, error: "Notifica non trovata" };
      }

      if (notificationSnapshot.data().destinatario_id !== userId) {
        return { success: false, error: "Non autorizzato a modificare questa notifica" };
      }

      await updateDoc(notificationDocRef, {
        letta: true,
        data_lettura: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'markNotificationAsRead');
    }
  }
}

export default NotificaService;