// Import della classe base e delle configurazioni con l'estensione .js
import FirebaseService from './firebase-service.js';
import { db } from '../api/firebase-config';
// Import necessari da 'firebase/firestore'
import { collection, query, where, getDocs, updateDoc, addDoc, limit, orderBy } from 'firebase/firestore';

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
    const dataToSave = { ...data, createdAt: new Date().toISOString() };
    return this._saveDocument('iniziative_popolari', dataToSave); 
  }

  static async getListaIniziativePopolari() {
    try {
        if (!db) return [];
        // Ordina per data di creazione per mostrare le più recenti
        const q = query(collection(db, 'iniziative_popolari'), orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        this.handleError(error, 'getListaIniziativePopolari');
        return [];
    }
  }

  // --- Referendum Abrogativi ---
  static async saveReferendumAbrogativo(data) { 
    const dataToSave = { ...data, createdAt: new Date().toISOString() };
    return this._saveDocument('referendum_abrogativi', dataToSave); 
  }

  static async getListaReferendumAbrogativi() {
    try {
        if (!db) return [];
        const q = query(collection(db, 'referendum_abrogativi'), orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        this.handleError(error, 'getListaReferendumAbrogativi');
        return [];
    }
  }

  // === Metodi generici per votazioni ===
  static async _registerUserVote(collectionName, userId, value, valueKey = 'nome') {
    try {
      if (!db) return { success: false, error: 'Database non configurato' };
      const q = query(collection(db, collectionName), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, { [valueKey]: value, timestamp: new Date().toISOString() });
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

}

export default VotoService; 