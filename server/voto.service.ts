import { db } from './firebase-config';
import { collection, query, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase-service';
import { ClassificaItem } from './types';

class VotoService extends FirebaseService {
  // Metodi con logica specifica
  public static async voteMinistro(userId: string, categoria: string, nomeMinistro: string): Promise<{ success: boolean; error?: string }> {
      try {
          if (!db) return { success: false, error: "DB non configurato" };
          const votiRef = collection(db, 'voti_ministri');
          const q = query(votiRef, where('userId', '==', userId), where('categoria', '==', categoria));
          const existingVotes = await getDocs(q);

          if (!existingVotes.empty) await updateDoc(existingVotes.docs[0].ref, { nomeMinistro, timestamp: new Date().toISOString() });
          else await addDoc(votiRef, { userId, categoria, nomeMinistro, timestamp: new Date().toISOString() });

          return { success: true };
      } catch (error) {
          return this.handleError(error, 'voteMinistro');
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
          return Object.entries(counts).map(([nome, voti]) => ({ nome, voti })).sort((a, b) => b.voti - a.voti).slice(0, 3);
      } catch (error) {
          this.handleError(error, `getClassificaMinistro (${categoria})`);
          return [];
      }
  }

  // Metodi che usano gli helper della classe base
  public static async voteCapoDiStato(userId: string, nome: string) { return this._registerUserVote('voti_capo_stato', userId, nome); }
  public static async getClassificaCapoDiStato() { return this._getLeaderboard('voti_capo_stato'); }

  // ... e così via per Grazia, Amnistia, Iniziative, Referendum ...
}

export default VotoService;