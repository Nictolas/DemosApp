// Import della classe base e delle configurazioni con l'estensione .js
import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class VotoService {

  // =========================================================
  // METODI PER IL GOVERNO IDEALE
  // =========================================================

  static async voteMinistro(userId, categoria, nomeMinistro) {
      try {
          console.log('voteMinistro chiamato con:', { userId, categoria, nomeMinistro });
          if (!pool) return { success: false, error: "Database non configurato" };
          let nomeRaw = (nomeMinistro || '').trim();
          if (!nomeRaw) return { success: false, error: "Nome non valido" };
          let nomeKey = nomeRaw.toLowerCase();
          let nomeDisplay = nomeRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          const votiRef = collection(db, 'voti_ministri');
          const q = query(votiRef, where('userId', '==', userId), where('categoria', '==', categoria));
          const existingVotes = await getDocs(q);

          if (!existingVotes.empty) {
              const docRef = existingVotes.docs[0].ref;
              await updateDoc(docRef, { nomeMinistro: nomeKey, nomeDisplay, timestamp: new Date().toISOString() });
          } else {
              await addDoc(votiRef, { userId, categoria, nomeMinistro: nomeKey, nomeDisplay, timestamp: new Date().toISOString() });
          }
          return { success: true };
      } catch (error) {
          console.error('ERRORE in voteMinistro:', error);
          return this.handleError(error, 'voteMinistro');
      }
  }

  static async getUserVotiMinistri(userId) {
    try {
        if (!pool) return {};
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
          if (!pool) return [];
          const q = query(collection(db, 'voti_ministri'), where('categoria', '==', categoria));
          const snapshot = await getDocs(q);
          const counts = {};
          const displayNames = {};
          snapshot.forEach(doc => {
              // Usa solo il campo normalizzato
              let nomeKey = (doc.data().nomeMinistro || '').trim().toLowerCase();
              let nomeDisplay = (doc.data().nomeDisplay || '').trim();
              if (!nomeKey) return;
              counts[nomeKey] = (counts[nomeKey] || 0) + 1;
              // Usa sempre il display più recente
              displayNames[nomeKey] = nomeDisplay || nomeKey;
          });
          // DEBUG: stampa i risultati aggregati
          console.log('Classifica aggregata:', counts, displayNames);
          return Object.entries(counts)
              .map(([key, voti]) => ({ nome: displayNames[key] || key, voti }))
              .sort((a, b) => b.voti - a.voti || a.nome.localeCompare(b.nome))
              .slice(0, 3);
      } catch (error) {
          this.handleError(error, `getClassificaMinistro (${categoria})`);
          return [];
      }
  }

  static async getAllClassificheMinistri() {
    const categorie = ['primo_ministro', 'esteri', 'interno', 'giustizia', 'difesa', 'economia', 'lavoro', 'istruzione', 'salute', 'cultura', 'ambiente_sicurezza_energetica'];
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
        if (!pool) return [];
        const q = query(collection(db, 'iniziative_popolari'), where('status', '==', 'accepted'), limit(10));
        const snapshot = await getDocs(q);
        const iniziative = await Promise.all(snapshot.docs.map(async doc => {
          const id = doc.id;
          const votiQ = query(collection(db, 'voti_iniziative_popolari'), where('iniziativaId', '==', id));
          const votiSnap = await getDocs(votiQ);
          return { id, ...doc.data(), voti: votiSnap.size };
        }));
        return iniziative;
    } catch (error) {
        this.handleError(error, 'getListaIniziativePopolari');
        return [];
    }
  }

  static async getPendingIniziativePopolari() {
    try {
      if (!pool) return [];
      const q = query(collection(db, 'iniziative_popolari'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getPendingIniziativePopolari');
    }
  }

  static async acceptIniziativaPopolare(requestId) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'iniziative_popolari', requestId);
      await updateDoc(requestRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectIniziativaPopolare');
    }
  }

  static async updateQuorumIniziativa(id, quorum) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return [];
      const q = query(collection(db, 'referendum_abrogativi'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getPendingReferendumAbrogativi');
    }
  }

  static async acceptReferendumAbrogativo(requestId) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'referendum_abrogativi', requestId);
      await updateDoc(requestRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectReferendumAbrogativo');
    }
  }

  static async updateQuorumReferendum(id, quorum) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
      const ref = doc(db, 'referendum_abrogativi', id);
      await updateDoc(ref, { quorum });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'updateQuorumReferendum');
    }
  }

  // --- Iniziative Popolari: Voto ---
  static async voteIniziativaPopolare(userId, iniziativaId) {
    return this._registerUserVote('voti_iniziative_popolari', userId, iniziativaId, 'iniziativaId');
  }

  // === Metodi generici per votazioni ===
  static async _registerUserVote(collectionName, userId, value, valueKey = 'nome') {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return [];
      const q = query(collection(db, collectionName), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data()[valueKey]);
    } catch (error) {
      return this.handleError(error, `_getUserVotes(${collectionName})`);
    }
  }

  static async _removeUserVote(collectionName, userId, value, valueKey = 'nome') {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return [];
      const q = query(collection(db, collectionName));
      const snapshot = await getDocs(q);
      const counts = {};
      const displayNames = {};
      snapshot.forEach(doc => {
        let value = (doc.data()[valueKey] || '').trim();
        if (!value) return;
        const key = value.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
        if (!displayNames[key] || value.length > displayNames[key].length) {
          displayNames[key] = value;
        }
      });
      return Object.entries(counts)
        .map(([key, voti]) => ({ nome: displayNames[key] || key, voti }))
        .sort((a, b) => b.voti - a.voti)
        .slice(0, 10);
    } catch (error) {
      return this.handleError(error, `_getLeaderboard(${collectionName})`);
    }
  }

  // ================= GESTIONE RICHIESTE GRAZIA ===================
  static async proposeGraziaRequest(userId, nome, urlProva) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return [];
      const q = query(collection(db, 'grazia_requests'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getPendingGraziaRequests');
    }
  }

  static async acceptGraziaRequest(requestId) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
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
      if (!pool) return { success: false, error: 'Database non configurato' };
      const requestRef = doc(db, 'grazia_requests', requestId);
      await updateDoc(requestRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectGraziaRequest');
    }
  }

  static async getClassificaReferendum() {
    try {
      if (!pool) return [];
      const q = query(collection(db, 'referendum_abrogativi'), where('status', '==', 'accepted'), orderBy('dataInizio', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return this.handleError(error, 'getClassificaReferendum');
    }
  }

  static async deleteAllVotesForCandidate(collectionName, nome, categoria) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
      // Cancella tutti i documenti con nomeMinistro normalizzato e categoria corrispondente
      const q = query(
        collection(db, collectionName),
        where('nomeMinistro', '==', nome),
        where('categoria', '==', categoria)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return { success: false, error: 'Nessun voto trovato per questo candidato' };
      const batchDeletes = [];
      snapshot.forEach(docSnap => {
        deleteDoc(docSnap.ref);
      });
      await Promise.all(batchDeletes);
      return { success: true };
    } catch (error) {
      return this.handleError(error, `deleteAllVotesForCandidate(${collectionName}, ${nome}, ${categoria})`);
    }
  }

  static async deleteIniziativaPopolare(id) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
      const ref = doc(db, 'iniziative_popolari', id);
      deleteDoc(ref);
      return { success: true };
    } catch (error) {
      return this.handleError(error, `deleteIniziativaPopolare(${id})`);
    }
  }

  static async deleteReferendumAbrogativo(id) {
    try {
      if (!pool) return { success: false, error: 'Database non configurato' };
      const ref = doc(db, 'referendum_abrogativi', id);
      deleteDoc(ref);
      return { success: true };
    } catch (error) {
      return this.handleError(error, `deleteReferendumAbrogativo(${id})`);
    }
  }

  static async voteReferendum(userId, referendumId) {
    return this._registerUserVote('voti_referendum_abrogativi', userId, referendumId, 'referendumId');
  }

  static async getListaReferendumAbrogativi() {
    try {
      console.log("INIZIO getListaReferendumAbrogativi");
      if (!pool) {
        console.log("DB non configurato");
        return [];
      }
      const q = query(
        collection(db, 'referendum_abrogativi'),
        where('status', '==', 'accepted'),
        where('quorum', '==', 'ok'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      console.log("Snapshot referendum_abrogativi:", snapshot.size);

      const referendum = await Promise.all(snapshot.docs.map(async doc => {
        try {
          const id = doc.id;
          console.log("Processo referendum id:", id);
          const votiQ = query(collection(db, 'voti_referendum_abrogativi'), where('referendumId', '==', id));
          const votiSnap = await getDocs(votiQ);
          console.log("Voti per referendum", id, ":", votiSnap.size);
          return { id, ...doc.data(), voti: votiSnap.size };
        } catch (e) {
          console.error("Errore su singolo referendum", doc.id, e);
          return null;
        }
      }));
      // Filtro eventuali null
      console.log("Referendum finali:", referendum.filter(Boolean).length);
      return referendum.filter(Boolean);
    } catch (error) {
      console.error("ERRORE getListaReferendumAbrogativi:", error);
      this.handleError(error, 'getListaReferendumAbrogativi');
      return [];
    }
  }

  // Restituisce la lista degli userId che hanno votato una specifica iniziativa popolare
  static async getVotersIniziativaPopolare(iniziativaId) {
    if (!pool) return [];
    const q = query(collection(db, 'voti_iniziative_popolari'), where('iniziativaId', '==', iniziativaId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().userId);
  }

  // Restituisce la lista degli userId che hanno votato un referendum abrogativo
  static async getVotersReferendumAbrogativo(referendumId) {
    if (!pool) return [];
    const q = query(collection(db, 'voti_referendum_abrogativi'), where('referendumId', '==', referendumId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().userId);
  }

  // Recupera i voti dell'utente per i referendum abrogativi
  static async getUserVotiReferendum(userId) {
    return this._getUserVotes('voti_referendum_abrogativi', userId, 'referendumId');
  }

  // Recupera i voti dell'utente per le iniziative popolari
  static async getUserVotiIniziativePopolari(userId) {
    return this._getUserVotes('voti_iniziative_popolari', userId, 'iniziativaId');
  }

}

export default VotoService; 