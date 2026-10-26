// ARCHIVED Firebase/Firestore notification service.
// This file is outside the Render api/ entrypoints, but third-party or manual
// imports cannot be ruled out. The historical FCM paths are fail-closed below.
// Never reopen them without current-consent validation and account ownership.

class NotificaService {
  /**
   * Invia notifiche a tutti gli utenti che hanno scelto un rappresentante specifico.
   */
  static async sendNotificationsForComunicazione(
    rappresentanteEmail,
    rappresentanteNome,
    rappresentanteCognome,
    titolo,
    votoDato,
    commento,
    vincitore,
    comunicazioneId
  ) {
    try {
      const rappresentanteIdFirebase = this.emailToId(rappresentanteEmail);
      const usersSnapshot = await getDocs(collection(db, 'utenti'));
      const notificationPromises = [];

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
  static async getUserNotifications(userId) {
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
  static async markNotificationAsRead(notificationId, userId) {
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

  /**
   * Elimina tutte le notifiche associate a una specifica comunicazione.
   * Usato principalmente quando una comunicazione viene cancellata.
   */
  static async deleteNotificationsForComunicazione(comunicazioneId) {
    try {
        if (!db) {
            console.error("Firebase Firestore non è configurato");
            return;
        }

        const q = query(collection(db, 'notifiche'), where('comunicazione_id', '==', comunicazioneId));
        const querySnapshot = await getDocs(q);

        const deletePromises = [];
        querySnapshot.forEach((notificaDoc) => {
            deletePromises.push(deleteDoc(doc(db, 'notifiche', notificaDoc.id)));
        });

        await Promise.all(deletePromises);
        console.log(`Eliminate ${deletePromises.length} notifiche per comunicazione ${comunicazioneId}`);
    } catch (error) {
        this.handleError(error, 'deleteNotificationsForComunicazione');
    }
  }

  // Aggiunto il metodo emailToId, che mancava
  static emailToId(email) {
    return email.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * DISABLED: historical Firestore FCM tokens are not a current-consent source.
   * Never send to an unverified device or to an unfiltered Firebase topic.
   * Keep the old signatures for explicit fail-closed compatibility.
   */
  static async sendPushNotification(userId, title, body, data = {}) {
    return { success: false, error: 'LEGACY_FIREBASE_PUSH_DISABLED' };
  }

  static async sendPushNotificationsForComunicazione(
    rappresentanteId,
    rappresentanteNome,
    rappresentanteCognome,
    titolo,
    votoDato,
    commento,
    vincitore,
    comunicazioneId
  ) {
    return { success: false, error: 'LEGACY_FIREBASE_PUSH_DISABLED' };
  }
}

export default NotificaService;
