// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { db } from './firebase-config.js';

// Import necessari da 'firebase/firestore'
import { collection, query, where, getDocs, updateDoc, addDoc, limit, orderBy } from 'firebase/firestore';

// Import dei tipi necessari con percorso corretto
import { ClassificaItem } from './types.js';

class VotoService extends FirebaseService {

  // =========================================================
  // METODI PER IL GOVERNO IDEALE
  // =========================================================

  public static async voteMinistro(userId: string, categoria: string, nomeMinistro: string): Promise<{ success: boolean; error?: string }> {
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

  public static async getUserVotiMinistri(userId: string): Promise<Record<string, string>> {
    try {
        if (!db) return {};
        const q = query(collection(db, 'voti_ministri'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const voti: Record<string, string> = {};
        snapshot.forEach(doc => {
            voti[doc.data().categoria] = doc.data().nomeMinistro;
        });
        return voti;
    } catch (error) {
        this.handleError(error, 'getUserVotiMinistri');
        return {};
    }
  }

  public static async getClassificaMinistro(categoria: string): Promise<ClassificaItem[]> {
      try {
          if (!db) return [];
          const q = query(collection(db, 'voti_ministri'), where('categoria', '==', categoria));
          const snapshot = await getDocs(q);
          const counts: Record<string, number> = {};
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

  public static async getAllClassificheMinistri(): Promise<Record<string, ClassificaItem[]>> {
    const categorie = ['primo_ministro', 'esteri', 'interno', 'giustizia', 'difesa', 'economia', 'lavoro', 'istruzione', 'salute', 'cultura'];
    const classifiche: Record<string, ClassificaItem[]> = {};
    for (const categoria of categorie) {
      classifiche[categoria] = await this.getClassificaMinistro(categoria);
    }
    return classifiche;
  }

  // =========================================================
  // METODI PER VOTO DIRETTO
  // =========================================================

  // --- Capo di Stato ---
  public static async voteCapoDiStato(userId: string, nome: string) { return this._registerUserVote('voti_capo_stato', userId, nome); }
  public static async getUserVotiCapoDiStato(userId: string) { return this._getUserVotes('voti_capo_stato', userId); }
  public static async removeVoteCapoDiStato(userId: string, nome: string) { return this._removeUserVote('voti_capo_stato', userId, nome); }
  public static async getClassificaCapoDiStato() { return this._getLeaderboard('voti_capo_stato'); }

  // --- Grazia ---
  public static async voteGrazia(userId: string, nome: string) { return this._registerUserVote('voti_grazia', userId, nome); }
  public static async getUserVotiGrazia(userId: string) { return this._getUserVotes('voti_grazia', userId); }
  public static async removeVoteGrazia(userId: string, nome: string) { return this._removeUserVote('voti_grazia', userId, nome); }
  public static async getClassificaGrazia() { return this._getLeaderboard('voti_grazia'); }

  // --- Amnistia ---
  public static async voteAmnistia(userId: string, legge: string) { return this._registerUserVote('voti_amnistia', userId, legge, 'legge'); }
  public static async getUserVotiAmnistia(userId: string) { return this._getUserVotes('voti_amnistia', userId, 'legge'); }
  public static async removeVoteAmnistia(userId: string, legge: string) { return this._removeUserVote('voti_amnistia', userId, legge, 'legge'); }
  public static async getClassificaAmnistia() { return this._getLeaderboard('voti_amnistia', 'legge'); }

  // --- Iniziative Popolari (con logica corretta) ---
  public static async saveIniziativaPopolare(data: any) { 
    // Quando si salva una nuova iniziativa, si inizializzano i voti a 0.
    const dataToSave = { ...data, voti: 0, createdAt: new Date().toISOString() };
    return this._saveDocument('iniziative_popolari', dataToSave); 
  }

  public static async voteIniziativaPopolare(userId: string, nome: string) { 
    const voteResult = await this._registerUserVote('voti_iniziative_popolari', userId, nome);

    // Se il voto ha avuto successo, aggiorna il contatore dei voti sull'iniziativa stessa.
    if(voteResult.success) {
        try {
            const q = query(collection(db, 'iniziative_popolari'), where('nome', '==', nome), limit(1));
            const snapshot = await getDocs(q);
            if(!snapshot.empty) {
                const docRef = snapshot.docs[0].ref;
                const currentVotes = snapshot.docs[0].data().voti || 0;
                await updateDoc(docRef, { voti: currentVotes + 1 });
            }
        } catch (error) {
            console.error("Errore nell'aggiornare il conteggio dei voti per l'iniziativa:", error);
            // Non bloccare l'operazione se questo fallisce, ma logga l'errore.
        }
    }
    return voteResult;
  }

  public static async getUserVotiIniziativePopolari(userId: string) { 
    return this._getUserVotes('voti_iniziative_popolari', userId); 
  }

  // Metodo specifico per la classifica, che ora non usa _getLeaderboard
  public static async getClassificaIniziativePopolari(): Promise<any[]> {
    try {
        if (!db) return [];
        // Ordina direttamente le iniziative per numero di voti decrescente.
        const q = query(collection(db, 'iniziative_popolari'), orderBy('voti', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        this.handleError(error, 'getClassificaIniziativePopolari');
        return [];
    }
  }

  // --- Referendum Abrogativi (con la stessa logica di Iniziative) ---
  public static async saveReferendumAbrogativo(data: any) { 
    const dataToSave = { ...data, voti: 0, createdAt: new Date().toISOString() };
    return this._saveDocument('referendum_abrogativi', dataToSave); 
  }

  public static async voteReferendumAbrogativo(userId: string, nome: string) { 
    const voteResult = await this._registerUserVote('voti_referendum_abrogativi', userId, nome);
    if(voteResult.success) {
        try {
            const q = query(collection(db, 'referendum_abrogativi'), where('nome', '==', nome), limit(1));
            const snapshot = await getDocs(q);
            if(!snapshot.empty) {
                const docRef = snapshot.docs[0].ref;
                const currentVotes = snapshot.docs[0].data().voti || 0;
                await updateDoc(docRef, { voti: currentVotes + 1 });
            }
        } catch (error) {
            console.error("Errore nell'aggiornare il conteggio dei voti per il referendum:", error);
        }
    }
    return voteResult;
  }

  public static async getUserVotiReferendumAbrogativi(userId: string) { 
    return this._getUserVotes('voti_referendum_abrogativi', userId); 
  }

  public static async getClassificaReferendumAbrogativi(): Promise<any[]> {
    try {
        if (!db) return [];
        const q = query(collection(db, 'referendum_abrogativi'), orderBy('voti', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        this.handleError(error, 'getClassificaReferendumAbrogativi');
        return [];
    }
  }
}

export default VotoService;