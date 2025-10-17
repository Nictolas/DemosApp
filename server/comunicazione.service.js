// Import della classe base e delle configurazioni con .js
import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
  static async createComunicazione(
    user,
    data
  ) {
    try {
      if (!user.uid || !user.email) return { success: false, error: "Dati utente in sessione incompleti" };

      const userData = await UserService.getUserById(user.uid);
      if (!userData || (userData.ruolo !== 'Politico' && userData.ruolo !== 'Candidato Politico')) {
        return { success: false, error: "Permessi non sufficienti per creare una comunicazione" };
      }

      // 1. Elimina la comunicazione precedente SOLO per lo stesso grado_elezione
      await this.deletePreviousComunicazioni(user.uid, data.grado_elezione); // <-- ora richiede anche il grado_elezione

      // 2. Prepara e salva la nuova comunicazione
      const comunicazioneData = {
        id_utente: user.uid,
        nome: userData.nome,
        cognome: userData.cognome,
        ruolo: userData.ruolo,
        grado_elezione: data.grado_elezione, // <-- aggiungi il grado_elezione
        avatar_config: userData.avatar_config || null, // <-- aggiungi avatar_config
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

      // 4. Invia le notifiche ai sostenitori (sia in-app che push)
      if (userData.nome && userData.cognome) {
          // Notifiche in-app (esistenti)
          await NotificaService.sendNotificationsForComunicazione(
            user.uid, // ID utente del rappresentante
            userData.nome,
            userData.cognome,
            data.titolo,
            data.voto_dato,
            data.commento || "",
            data.vincitore,
            comunicazioneId
          );

          // Notifiche push (nuove)
          await NotificaService.sendPushNotificationsForComunicazione(
            user.uid, // ID utente del rappresentante
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
  static async deletePreviousComunicazioni(userId, grado_elezione) {
    if (!db) return;
    const q = query(
      collection(db, 'comunicazioni'),
      where('id_utente', '==', userId),
      where('grado_elezione', '==', grado_elezione) // filtro per grado_elezione
    );
    const querySnapshot = await getDocs(q);

    const deletePromises = [];
    querySnapshot.forEach((docToDelete) => {
      deletePromises.push(deleteDoc(docToDelete.ref));
      // Innesca l'eliminazione delle notifiche associate
      deletePromises.push(NotificaService.deleteNotificationsForComunicazione(docToDelete.id));
    });

    await Promise.all(deletePromises);
    console.log(`Eliminate ${querySnapshot.size} comunicazioni precedenti per utente: ${userId} e grado_elezione: ${grado_elezione}`);
  }

  /**
   * Controlla se esiste già una comunicazione con lo stesso titolo e zona
   */
  static async checkDuplicateComunicazione(titolo, zona) {
    if (!db) return { exists: false };
    const q = query(collection(db, 'comunicazioni'), where('titolo', '==', titolo), where('zona', '==', zona));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return { exists: true, comunicazione: docData };
    }
    return { exists: false };
  }

  /**
   * Restituisce l'ultima comunicazione inviata dall'utente
   */
  static async getUltimaComunicazione(userId) {
    if (!db) return null;
    const q = query(collection(db, 'comunicazioni'), where('id_utente', '==', userId), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    return null;
  }

  /**
   * Recupera la classifica dei politici basata sui punti trasparenza.
   * @param tipoPodio 'europeo' | 'senato' | 'camera' | 'regionale' | 'comunale'
   * @param regione Regione di residenza dell'utente (per podio regionale)
   * @param comune Comune di residenza dell'utente (per podio comunale)
   */
  static async getPodioTrasparenza(tipoPodio = 'europeo', regione = '', comune = '') {
    try {
      if (!db) return [];
      const querySnapshot = await getDocs(collection(db, 'comunicazioni'));

      const userPoints = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filtra in base al tipo di podio richiesto
        let include = false;
        switch (tipoPodio) {
          case 'europeo':
            include = data.ruolo === "P" || data.ruolo === "CP";
            break;
          case 'senato':
            include = data.ruolo === 'Senatore' || data.ruolo === 'Candidato Senatore';
            break;
          case 'camera':
            include = data.ruolo === 'Deputato' || data.ruolo === 'Candidato Deputato';
            break;
          case 'regionale':
            include = data.regione_residenza === regione;
            break;
          case 'comunale':
            include = data.comune_residenza === comune;
            break;
          default:
            include = true;
        }
        if (!include) return;
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
  static async reactToComunicazione(comunicazioneId, userId, reaction) {
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