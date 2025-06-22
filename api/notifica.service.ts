// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { adminDb } from './firebase-config.js';

// Import necessari da 'firebase/firestore'
import { collection, query, where, getDocs, doc, addDoc, updateDoc, getDoc, DocumentReference, deleteDoc } from 'firebase/firestore';

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
      if (!adminDb) {
        console.error("Firebase Firestore non è configurato per inviare notifiche.");
        return;
      }
      const rappresentanteIdFirebase = this.emailToId(rappresentanteEmail);
      const usersSnapshot = await adminDb.collection('utenti').get();
      const notificationPromises: Promise<FirebaseFirestore.DocumentReference>[] = [];
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const rappresentantiScelti = [
            userData.rappresentante_europeo,
            userData.rappresentante_camera,
            userData.rappresentante_senato,
            userData.rappresentante_regionale,
            userData.rappresentante_comunale
        ].filter(Boolean);
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
          notificationPromises.push(adminDb.collection('notifiche').add(notificationData));
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
      if (!adminDb) return [];
      const q = adminDb.collection('notifiche').where('destinatario_id', '==', userId);
      const querySnapshot = await q.get();
      const notifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifications.sort((a: any, b: any) => 
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
      if (!adminDb) return { success: false, error: "Database non configurato" };
      const notificationDocRef = adminDb.collection('notifiche').doc(notificationId);
      const notificationSnapshot = await notificationDocRef.get();
      if (!notificationSnapshot.exists) {
        return { success: false, error: "Notifica non trovata" };
      }
      if (notificationSnapshot.data().destinatario_id !== userId) {
        return { success: false, error: "Non autorizzato a modificare questa notifica" };
      }
      await notificationDocRef.update({
        letta: true,
        data_lettura: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'markNotificationAsRead');
    }
  }

  /**
   * Elimina tutte le notifiche associate a una specifica comunicazione.
   * Usato principalmente quando una comunicazione viene cancellata.
   */
  public static async deleteNotificationsForComunicazione(comunicazioneId: string): Promise<void> {
    try {
      if (!adminDb) {
        console.error("Firebase Firestore non è configurato");
        return;
      }
      const q = adminDb.collection('notifiche').where('comunicazione_id', '==', comunicazioneId);
      const querySnapshot = await q.get();
      const deletePromises: Promise<FirebaseFirestore.WriteResult>[] = [];
      querySnapshot.forEach((notificaDoc) => {
        deletePromises.push(notificaDoc.ref.delete());
      });
      await Promise.all(deletePromises);
      console.log(`Eliminate ${deletePromises.length} notifiche per comunicazione ${comunicazioneId}`);
    } catch (error) {
      this.handleError(error, 'deleteNotificationsForComunicazione');
    }
  }
}

export default NotificaService;