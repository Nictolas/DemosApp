// Import della classe base e delle configurazioni con l'estensione .js
import FirebaseService from './firebase-service.js';
import { db } from '../api/firebase-config.js';
// Import necessari da 'firebase/firestore'
import { collection, query, where, getDocs, updateDoc, addDoc, limit, orderBy, doc, deleteDoc, getDoc } from 'firebase/firestore';

class VotoService extends FirebaseService {

  // =========================================================
  // METODI PER IL GOVERNO IDEALE
  // =========================================================

  static async voteMinistro(userId, categoria, nomeMinistro) {
      try {
          if (!db) return { success: false, error: "Database non configurato" };
          const votiRef = collection(db, 'voti_ministri');
          const q = query(votiRef, where('userId', '==', userId), where('categoria', '==', categoria));
          const existingVotes = await getDocs(q);

          if (!existingVotes.empty) {
              await updateDoc(existingVotes.docs[0].ref, { nomeMinistro, timestamp: new Date().toISOString() });
          } else {
              await addDoc(votiRef, { userId, categoria, nomeMinistro, timestamp: new Date().toISOString() });
          }
          return { success: true };
      } catch (error) {
          return this.handleError(error, 'voteMinistro');
      }
  }

  static async getUserVotiMinistri(userId) {
    try {
        if (!db) return {};
        const q = query(collection(db, 'voti_ministri'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const voti = {};
        snapshot.forEach(doc => {
            voti[doc.data().categoria] = doc.data().nomeMinistro;
        });
        return voti;
    } catch (error) {
        this.handleError(error, 'getUserVotiMinistri');
        return {};
    }
  }

  static async getClassificaMinistro(categoria) {
      try {
          if (!db) return [];
          const q = query(collection(db, 'voti_ministri'), where('categoria', '==', categoria));
          const snapshot = await getDocs(q);
          const counts = {};
          snapshot.forEach(doc => {
              counts[doc.data().nomeMinistro] = (counts[doc.data().nomeMinistro] || 0) + 1;
          });
          return Object.entries(counts)
              .map(([nome, voti]) => ({ nome, voti }))
              .sort((a, b) => b.voti - a.voti)
              .slice(0, 3);
      } catch (error) {
          this.handleError(error, `getClassificaMinistro (${categoria})`);
          return [];
      }
  }

  static async getAllClassificheMinistri() {
    const categorie = ['primo_ministro', 'esteri', 'interno', 'giustizia', 'difesa', 'economia', 'lavoro', 'istruzione', 'salute', 'cultura'];
    const classifiche = {};
    for (const categoria of categorie) {
      classifiche[categoria] = await this.getClassificaMinistro(categoria);
    }
    return classifiche;
  }

  // =========================================================
  // METODI PER VOTO DIRETTO
  // =========================================================

  // --- Capo di Stato ---
  static async voteCapoDiStato(userId, nome) { return this._registerUserVote('voti_capo_stato', userId, nome); }
  static async getUserVotiCapoDiStato(userId) { return this._getUserVotes('voti_capo_stato', userId); }
  static async removeVoteCapoDiStato(userId, nome) { return this._removeUserVote('voti_capo_stato', userId, nome); }
  static async getClassificaCapoDiStato() { return this._getLeaderboard('voti_capo_stato'); }

  // --- Grazia ---
  static async voteGrazia(userId, nome) { return this._registerUserVote('voti_grazia', userId, nome); }
  static async getUserVotiGrazia(userId) { return this._getUserVotes('voti_grazia', userId); }
  static async removeVoteGrazia(userId, nome) { return this._removeUserVote('voti_grazia', userId, nome); }
  static async getClassificaGrazia() { return this._getLeaderboard('voti_grazia'); }

  // --- Amnistia ---
  static async voteAmnistia(userId, legge) { return this._registerUserVote('voti_amnistia', userId, legge, 'legge'); }
  static async getUserVotiAmnistia(userId) { return this._getUserVotes('voti_amnistia', userId, 'legge'); }
  static async removeVoteAmnistia(userId, legge) { return this._removeUserVote('voti_amnistia', userId, legge, 'legge'); }
  static async getClassificaAmnistia() { return this._getLeaderboard('voti_amnistia', 'legge'); }

  // =========================================================
  // LOGICA CORRETTA PER INIZIATIVE E REFERENDUM
  // =========================================================

  // --- Iniziative Popolari ---
  static async saveIniziativaPopolare(data) { 
    const dataToSave = { ...data, createdAt: new Date().toISOString(), status: 'pending', quorum: 'pending' };
    return this._saveDocument('iniziative_popolari', dataToSave); 
  }

  static async getListaIniziativePopolari() {
    try {
        if (!db) return [];
        // Mostra solo le iniziative approvate (status: 'accepted'), senza orderBy su data_creazione per evitare errori di indice
        const q = query(collection(db, 'iniziative_popolari'), where('status', '==', 'accepted'), limit(10));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        this.handleError(error, 'getListaIniziativePopolari');
        return [];
    }
  }

  static async getPendingIniziativePopolari() {
    try {
      if (!db) return [];
      const q = query(collection(db, 'iniziative_popolari'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getPendingIniziativePopolari');
    }
  }

  static async acceptIniziativaPopolare(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'iniziative_popolari', requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) return { success: false, error: 'Richiesta non trovata' };
      await updateDoc(requestRef, { status: 'accepted', acceptedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'acceptIniziativaPopolare');
    }
  }

  static async rejectIniziativaPopolare(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'iniziative_popolari', requestId);
      await updateDoc(requestRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectIniziativaPopolare');
    }
  }

  static async updateQuorumIniziativa(id, quorum) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const ref = doc(db, 'iniziative_popolari', id);
      await updateDoc(ref, { quorum });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'updateQuorumIniziativa');
    }
  }

  // --- Referendum Abrogativi ---
  static async saveReferendumAbrogativo(data) { 
    const dataToSave = { ...data, createdAt: new Date().toISOString(), status: 'pending', quorum: 'pending' };
    return this._saveDocument('referendum_abrogativi', dataToSave); 
  }

  static async getPendingReferendumAbrogativi() {
    try {
      if (!db) return [];
      const q = query(collection(db, 'referendum_abrogativi'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getPendingReferendumAbrogativi');
    }
  }

  static async acceptReferendumAbrogativo(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'referendum_abrogativi', requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) return { success: false, error: 'Richiesta non trovata' };
      await updateDoc(requestRef, { status: 'accepted', acceptedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'acceptReferendumAbrogativo');
    }
  }

  static async rejectReferendumAbrogativo(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'referendum_abrogativi', requestId);
      await updateDoc(requestRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectReferendumAbrogativo');
    }
  }

  static async updateQuorumReferendum(id, quorum) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const ref = doc(db, 'referendum_abrogativi', id);
      await updateDoc(ref, { quorum });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'updateQuorumReferendum');
    }
  }

  // === Metodi generici per votazioni ===
  static async _registerUserVote(collectionName, userId, value, valueKey = 'nome') {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      // Permetti più voti per utente: uno per ogni candidato
      const q = query(collection(db, collectionName), where('userId', '==', userId), where(valueKey, '==', value));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        // Se già votato per questo candidato, aggiorna solo il timestamp
        await updateDoc(snapshot.docs[0].ref, { timestamp: new Date().toISOString() });
      } else {
        const data = { userId, timestamp: new Date().toISOString() };
        data[valueKey] = value;
        await addDoc(collection(db, collectionName), data);
      }
      return { success: true };
    } catch (error) {
      return this.handleError(error, `_registerUserVote(${collectionName})`);
    }
  }

  static async _getUserVotes(collectionName, userId, valueKey = 'nome') {
    try {
      if (!db) return [];
      const q = query(collection(db, collectionName), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data()[valueKey]);
    } catch (error) {
      return this.handleError(error, `_getUserVotes(${collectionName})`);
    }
  }

  static async _removeUserVote(collectionName, userId, value, valueKey = 'nome') {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const q = query(collection(db, collectionName), where('userId', '==', userId), where(valueKey, '==', value));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, { [valueKey]: null });
      }
      return { success: true };
    } catch (error) {
      return this.handleError(error, `_removeUserVote(${collectionName})`);
    }
  }

  static async _getLeaderboard(collectionName, valueKey = 'nome') {
    try {
      if (!db) return [];
      const q = query(collection(db, collectionName));
      const snapshot = await getDocs(q);
      const counts = {};
      snapshot.forEach(doc => {
        const value = doc.data()[valueKey];
        if (value) counts[value] = (counts[value] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([nome, voti]) => ({ nome, voti }))
        .sort((a, b) => b.voti - a.voti)
        .slice(0, 10);
    } catch (error) {
      return this.handleError(error, `_getLeaderboard(${collectionName})`);
    }
  }

  // ================= GESTIONE RICHIESTE GRAZIA ===================
  static async proposeGraziaRequest(userId, nome, urlProva) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      // Salva la richiesta solo se non esiste già una identica pendente
      const q = query(collection(db, 'grazia_requests'), where('nome', '==', nome), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { success: false, error: 'Richiesta già presente e in attesa di approvazione' };
      }
      await addDoc(collection(db, 'grazia_requests'), {
        userId,
        nome,
        urlProva,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'proposeGraziaRequest');
    }
  }

  static async getPendingGraziaRequests() {
    try {
      if (!db) return [];
      const q = query(collection(db, 'grazia_requests'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getPendingGraziaRequests');
    }
  }

  static async acceptGraziaRequest(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'grazia_requests', requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) return { success: false, error: 'Richiesta non trovata' };
      const { nome } = requestSnap.data();
      // Aggiorna la richiesta come accettata
      await updateDoc(requestRef, { status: 'accepted', acceptedAt: new Date().toISOString() });
      // Aggiungi il nome ai votabili (opzionale: qui puoi aggiungere logica per inserirlo in una collection "candidati_grazia" se serve)
      // Per ora, il nome sarà votabile semplicemente perché l'admin lo ha accettato
      return { success: true, nome };
    } catch (error) {
      return this.handleError(error, 'acceptGraziaRequest');
    }
  }

  static async rejectGraziaRequest(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'grazia_requests', requestId);
      await updateDoc(requestRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectGraziaRequest');
    }
  }

  static async getClassificaReferendum() {
    try {
      if (!db) return [];
      const q = query(collection(db, 'referendum_abrogativi'), where('status', '==', 'accepted'), orderBy('dataInizio', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getClassificaReferendum');
    }
  }

  static async deleteAllVotesForCandidate(collectionName, nome) {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const q = query(collection(db, collectionName), where('nome', '==', nome));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return { success: false, error: 'Nessun voto trovato per questo candidato' };
      const batchDeletes = [];
      snapshot.forEach(docSnap => {
        batchDeletes.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(batchDeletes);
      return { success: true };
    } catch (error) {
      return this.handleError(error, `deleteAllVotesForCandidate(${collectionName}, ${nome})`);
    }
  }

}

export default VotoService; 