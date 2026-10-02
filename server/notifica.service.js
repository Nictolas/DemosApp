import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

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
   * Invia notifica push a un utente specifico
   */
  static async sendPushNotification(userId, title, body, data = {}) {
    try {
      if (!adminDb) {
        console.error("Firebase Admin non configurato per notifiche push");
        return { success: false, error: "Admin SDK non configurato" };
      }

      // Ottieni il token FCM dell'utente
      const userDoc = await adminDb.collection('utenti').doc(userId).get();
      if (!userDoc.exists) {
        return { success: false, error: "Utente non trovato" };
      }

      const userData = userDoc.data();
      if (!userData.fcmToken) {
        return { success: false, error: "Token FCM non trovato per questo utente" };
      }

      // Invia la notifica push
      const message = {
        token: userData.fcmToken,
        notification: {
          title: title,
          body: body
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // Per compatibilità mobile
        },
        webpush: {
          headers: {
            'Urgency': 'high'
          },
          notification: {
            icon: '/icona.png',
            badge: '/icona.png',
            tag: 'demos-notification',
            requireInteraction: true,
            actions: [
              {
                action: 'open',
                title: 'Apri'
              },
              {
                action: 'close',
                title: 'Chiudi'
              }
            ]
          }
        }
      };

      const response = await adminDb.app.messaging().send(message);
      console.log(`Notifica push inviata a ${userId}:`, response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Errore invio notifica push:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Invia notifiche push a tutti gli utenti che hanno scelto un rappresentante specifico.
   */
  static async sendPushNotificationsForComunicazione(
    rappresentanteId, // <-- ora passiamo direttamente l'ID utente del politico/candidato
    rappresentanteNome,
    rappresentanteCognome,
    titolo,
    votoDato,
    commento,
    vincitore,
    comunicazioneId
  ) {
    try {
      if (!adminDb) {
        console.error("Firebase Admin non è configurato per inviare notifiche push.");
        return;
      }

      // Query per trovare tutti i sostenitori che hanno scelto questo rappresentante
      const usersSnapshot = await adminDb.collection('utenti').get();
      const pushNotificationPromises = [];

      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        // Controlla tutti i campi rappresentante
        const rappresentantiScelti = [
          userData.rappresentante_europeo,
          userData.rappresentante_camera,
          userData.rappresentante_senato,
          userData.rappresentante_regionale,
          userData.rappresentante_comunale
        ].filter(Boolean);

        // Se l'utente segue questo rappresentante, invia la notifica
        if (rappresentantiScelti.includes(rappresentanteId) && userData.fcmToken) {
          const notificationTitle = `Nuova comunicazione da ${rappresentanteNome} ${rappresentanteCognome}`;
          const notificationBody = `${titolo} - Voto: ${votoDato}`;
          pushNotificationPromises.push(
            this.sendPushNotification(
              userDoc.id,
              notificationTitle,
              notificationBody,
              {
                type: 'comunicazione',
                comunicazioneId: comunicazioneId,
                rappresentanteId: rappresentanteId,
                votoDato: votoDato,
                vincitore: vincitore
              }
            )
          );
        }
      });

      const results = await Promise.allSettled(pushNotificationPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.length - successCount;

      console.log(`Notifiche push inviate: ${successCount} successi, ${failureCount} fallimenti`);

      // Invia la notifica push anche al topic dei sostenitori
      const topic = `sostenitori_politico_${rappresentanteId}`;
      const topicMessage = {
        topic,
        notification: {
          title: `Nuova comunicazione da ${rappresentanteNome} ${rappresentanteCognome}`,
          body: `${titolo} - Voto: ${votoDato}`
        },
        data: {
          type: 'comunicazione',
          comunicazioneId: comunicazioneId,
          rappresentanteId: rappresentanteId,
          votoDato: votoDato,
          vincitore: vincitore
        },
        webpush: {
          headers: {
            'Urgency': 'high'
          },
          notification: {
            icon: '/icona.png',
            badge: '/icona.png',
            tag: 'demos-notification',
            requireInteraction: true,
            actions: [
              { action: 'open', title: 'Apri' },
              { action: 'close', title: 'Chiudi' }
            ]
          }
        }
      };
      try {
        const topicResponse = await adminDb.app.messaging().send(topicMessage);
        console.log(`Notifica push inviata al topic ${topic}:`, topicResponse);
      } catch (err) {
        console.error('Errore invio notifica push al topic:', err);
      }
    } catch (error) {
      this.handleError(error, 'sendPushNotificationsForComunicazione');
    }
  }
}

export default NotificaService; 