// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { adminDb } from './firebase-config.js';

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
      if (!adminDb) return { success: false, error: "Database non configurato" };
      const votiRef = adminDb.collection('voti_ministri');
      const q = votiRef.where('userId', '==', userId).where('categoria', '==', categoria);
      const existingVotes = await q.get();
      
      if (!existingVotes.empty) {
        return { success: false, error: "Hai già votato per questa categoria" };
      }
      
      await votiRef.add({
        userId,
        categoria,
        nomeMinistro,
        timestamp: new Date().toISOString()
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Errore nel voto: ${error}` };
    }
  }

  public static async getUserVotiMinistri(userId: string): Promise<Record<string, string>> {
    try {
      if (!adminDb) return {};
      const q = adminDb.collection('voti_ministri').where('userId', '==', userId);
      const snapshot = await q.get();
      const voti: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        voti[data.categoria] = data.nomeMinistro;
      });
      return voti;
    } catch (error) {
      console.error('Errore nel recupero voti ministri:', error);
      return {};
    }
  }

  public static async getClassificaMinistro(categoria: string): Promise<ClassificaItem[]> {
    try {
      if (!adminDb) return [];
      const q = adminDb.collection('voti_ministri').where('categoria', '==', categoria);
      const snapshot = await q.get();
      const counts: Record<string, number> = {};
      
      snapshot.docs.forEach(doc => {
        const nomeMinistro = doc.data().nomeMinistro;
        counts[nomeMinistro] = (counts[nomeMinistro] || 0) + 1;
      });
      
      return Object.entries(counts)
        .map(([nome, voti]) => ({ nome, voti }))
        .sort((a, b) => b.voti - a.voti);
    } catch (error) {
      console.error('Errore nel recupero classifica ministro:', error);
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

  // =========================================================
  // LOGICA CORRETTA PER INIZIATIVE E REFERENDUM
  // =========================================================

  // --- Iniziative Popolari ---
  public static async saveIniziativaPopolare(data: any) { 
    const dataToSave = { ...data, createdAt: new Date().toISOString() };
    return this._saveDocument('iniziative_popolari', dataToSave); 
  }

  public static async getListaIniziativePopolari(): Promise<any[]> {
    try {
      if (!adminDb) return [];
      const q = adminDb.collection('iniziative_popolari').orderBy('createdAt', 'desc').limit(10);
      const snapshot = await q.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Errore nel recupero iniziative popolari:', error);
      return [];
    }
  }

  // --- Referendum Abrogativi ---
  public static async saveReferendumAbrogativo(data: any) { 
    const dataToSave = { ...data, createdAt: new Date().toISOString() };
    return this._saveDocument('referendum_abrogativi', dataToSave); 
  }

  public static async getListaReferendumAbrogativi(): Promise<any[]> {
    try {
      if (!adminDb) return [];
      const q = adminDb.collection('referendum_abrogativi').orderBy('createdAt', 'desc').limit(10);
      const snapshot = await q.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Errore nel recupero referendum abrogativi:', error);
      return [];
    }
  }
}

export default VotoService;