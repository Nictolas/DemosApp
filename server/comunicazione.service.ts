// Import della classe base e delle configurazioni con .js
import FirebaseService from './firebase-service';
import { db } from '../api/firebase-config';

// Import dei servizi con cui questo deve interagire
import NotificaService from './notifica.service.js';
import UserService from './user.service.js';

// Import necessari da 'firebase/firestore'
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, limit, getDoc, runTransaction } from 'firebase/firestore';

class ComunicazioneService extends FirebaseService {

  /**
   * Crea una nuova comunicazione, gestendo tutte le operazioni correlate.
   * @param user L'utente autenticato che crea la comunicazione.
   * @param data Dati della comunicazione dal body della richiesta.
   */
  public static async createComunicazione(
    user: Express.User, 
    data: { titolo: string, voto_dato: string, commento?: string, vincitore: string, zona: string, isDuplicate?: boolean }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!user.uid || !user.email) return { success: false, error: "Dati utente in sessione incompleti" };

      const userData = await UserService.getUserById(user.uid);
      if (!userData || (userData.ruolo !== 'Politico' && userData.ruolo !== 'Candidato Politico')) {
        return { success: false, error: "Permessi non sufficienti per creare una comunicazione" };
      }

      // 1. Elimina le comunicazioni precedenti e le loro notifiche
      await this.deletePreviousComunicazioni(user.uid);

      // 2. Prepara e salva la nuova comunicazione
      const comunicazioneData = {
        id_utente: user.uid,
        nome: userData.nome,
        cognome: userData.cognome,
        ruolo: userData.ruolo,
        ...data,
        data_creazione: new Date().toISOString(),
        punti_trasparenza: data.isDuplicate ? 1 : 3,
        likes: 0,
        dislikes: 0
      };
      const saveResult = await this._saveDocument('comunicazioni', comunicazioneData);
      if (!saveResult.success || !saveResult.data) {
          return { success: false, error: saveResult.error || "Errore nel salvataggio della comunicazione" };
      }

      const comunicazioneId = saveResult.data.id;

      // 3. Aggiorna l'ultima comunicazione sul profilo dell'utente
      const ultimaComunicazione = {
        titolo: data.titolo,
        voto_dato: data.voto_dato,
        vincitore: data.vincitore,
        data: new Date().toISOString()
      };
      await UserService.updateUserData(user.email, { ultimaComunicazione });

      // 4. Invia le notifiche ai sostenitori
      if (userData.nome && userData.cognome) { // <-- AGGIUNGI QUESTO CONTROLLO
          await NotificaService.sendNotificationsForComunicazione(
            user.email,
            userData.nome,
            userData.cognome,
            data.titolo,
            data.voto_dato,
            data.commento || "",
            data.vincitore,
            comunicazioneId
          );
        }

      return { success: true, data: saveResult.data };

    } catch (error) {
      return this.handleError(error, 'createComunicazione');
    }
  }

  /**
   * Elimina tutte le comunicazioni e le notifiche associate per un dato utente.
   */
  private static async deletePreviousComunicazioni(userId: string): Promise<void> {
    if (!db) return;
    const q = query(collection(db, 'comunicazioni'), where('id_utente', '==', userId));
    const querySnapshot = await getDocs(q);

    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docToDelete) => {
      deletePromises.push(deleteDoc(docToDelete.ref));
      // Innesca l'eliminazione delle notifiche associate
      deletePromises.push(NotificaService.deleteNotificationsForComunicazione(docToDelete.id));
    });

    await Promise.all(deletePromises);
    console.log(`Eliminate ${querySnapshot.size} comunicazioni precedenti per utente: ${userId}`);
  }

  /**
   * Recupera la classifica dei politici basata sui punti trasparenza.
   */
  public static async getPodioTrasparenza(): Promise<any[]> {
    try {
      if (!db) return [];
      const querySnapshot = await getDocs(collection(db, 'comunicazioni'));

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

      return Object.values(userPoints)
        .sort((a, b) => b.punti_trasparenza_totali - a.punti_trasparenza_totali)
        .slice(0, 10);
    } catch (error) {
      this.handleError(error, 'getPodioTrasparenza');
      return [];
    }
  }

  /**
   * Registra una reazione (like/dislike) a una comunicazione, aggiornando i conteggi.
   */
  public static async reactToComunicazione(comunicazioneId: string, userId: string, reaction: 'like' | 'dislike'): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: "Database non configurato" };

    const comunicazioneDocRef = doc(db, 'comunicazioni', comunicazioneId);
    const reactionDocRef = doc(collection(db, 'reazioni'), `${userId}_${comunicazioneId}`);

    try {
      await runTransaction(db, async (transaction) => {
        const comunicazioneDoc = await transaction.get(comunicazioneDocRef);
        if (!comunicazioneDoc.exists()) throw new Error("Comunicazione non trovata.");

        const reactionDoc = await transaction.get(reactionDocRef);
        const currentLikes = comunicazioneDoc.data().likes || 0;
        const currentDislikes = comunicazioneDoc.data().dislikes || 0;
        const newCounts = { likes: currentLikes, dislikes: currentDislikes };

        if (reactionDoc.exists()) {
          const oldReaction = reactionDoc.data().tipo;
          if (oldReaction === reaction) { // L'utente toglie la reazione
            transaction.delete(reactionDocRef);
            if (reaction === 'like') newCounts.likes--;
            else newCounts.dislikes--;
          } else { // L'utente cambia reazione
            transaction.update(reactionDocRef, { tipo: reaction });
            if (reaction === 'like') {
              newCounts.likes++;
              newCounts.dislikes--;
            } else {
              newCounts.likes--;
              newCounts.dislikes++;
            }
          }
        } else { // Nuova reazione
          transaction.set(reactionDocRef, { comunicazione_id: comunicazioneId, utente_id: userId, tipo: reaction });
          if (reaction === 'like') newCounts.likes++;
          else newCounts.dislikes++;
        }

        transaction.update(comunicazioneDocRef, {
            likes: Math.max(0, newCounts.likes),
            dislikes: Math.max(0, newCounts.dislikes)
        });
      });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'reactToComunicazione');
    }
  }
}

export default ComunicazioneService; 