// Importa ANCHE l'adminDb dalla configurazione
import { db, adminDb } from './firebase-config.js';
import { collection, doc, getDoc, setDoc, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import { Utente, UserOpinions } from './types.js';
import { FirebaseService } from './firebase-service.js'; // Assicurati che l'import sia corretto

const getAgeCategory = (age: number | string): string => {
  const numAge = Number(age);
  if (isNaN(numAge)) return 'Non specificato';
  if (numAge <= 24) return '18-24';
  if (numAge <= 34) return '25-34';
  if (numAge <= 44) return '35-44';
  if (numAge <= 54) return '45-54';
  if (numAge <= 64) return '55-64';
  return '65+';
};

class UserService extends FirebaseService {

  public static async saveUserData(userData: Utente): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!db || !userData.email) return { success: false, error: "DB non conf. o email mancante" };
      const emailId = this.emailToId(userData.email);
      const userDocRef = doc(db, 'utenti', emailId);
      const dataToSave: Utente = { ...userData, id: emailId, updatedAt: new Date().toISOString() };
      if (!dataToSave.createdAt) { dataToSave.createdAt = new Date().toISOString(); }
      await setDoc(userDocRef, dataToSave, { merge: true });
      return { success: true, data: dataToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserData');
    }
  }

  public static async updateUserData(email: string, userData: Partial<Utente>): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const emailId = this.emailToId(email);
      const userDocRef = doc(db, 'utenti', emailId);
      const dataToUpdate = { ...userData, updatedAt: new Date().toISOString() };
      await updateDoc(userDocRef, dataToUpdate);
      return { success: true, data: dataToUpdate };
    } catch (error) {
      return this.handleError(error, 'updateUserData');
    }
  }

  public static async getUserByEmail(email: string): Promise<Utente | null> {
    try {
      if (!db) return null;
      const emailId = this.emailToId(email);
      const userDocRef = doc(db, 'utenti', emailId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Utente;
      const q = query(collection(db, 'utenti'), where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Utente;
      return null;
    } catch (error) {
      this.handleError(error, 'getUserByEmail');
      return null;
    }
  }

  /**
   * Recupera tutti gli utenti dalla collezione.
   * === MODIFICA CHIAVE: USA L'ADMIN SDK ===
   */
  public static async getAllUsers(): Promise<Utente[]> {
    try {
      // Usa adminDb per bypassare le regole di sicurezza di Firestore
      if (!adminDb) {
          console.error("Admin SDK non inizializzato. Impossibile recuperare tutti gli utenti.");
          return [];
      }
      // La sintassi dell'Admin SDK è leggermente diversa
      const snapshot = await adminDb.collection('utenti').get();
      if (snapshot.empty) {
        return [];
      }
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Utente));
    } catch (error) {
      this.handleError(error, 'getAllUsers');
      return [];
    }
  }

  public static async saveUserOpinions(userEmail: string, opinions: UserOpinions): Promise<{ success: boolean; data?: any; error?: string; }> {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const emailId = this.emailToId(userEmail);
      const userDocRef = doc(db, 'utenti', emailId);
      const opinionsToSave = { ...opinions, updatedAt: new Date().toISOString() };
      await setDoc(userDocRef, opinionsToSave, { merge: true });
      return { success: true, data: opinionsToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserOpinions');
    }
  }

  public static async getUserOpinions(userEmail: string): Promise<UserOpinions | null> {
    const user = await this.getUserByEmail(userEmail);
    if (!user) return null;
    return {
      energia_nucleare: user.energia_nucleare,
      sperimentazione_animale: user.sperimentazione_animale,
      legalizzazione_canapa: user.legalizzazione_canapa,
      caccia: user.caccia,
      unione_europea: user.unione_europea,
    };
  }

  public static async getCandidati(): Promise<Utente[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => 
      user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico'
    );
  }

  public static async searchPoliticians(searchTerm: string): Promise<Utente[]> {
    const allUsers = await this.getAllUsers();
    const q = searchTerm.toLowerCase();
    return allUsers.filter(user =>
      (user.ruolo === 'Politico' || user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico') &&
      (`${user.nome} ${user.cognome}`.toLowerCase().includes(q))
    );
  }
  // Aggiungi questo intero blocco di codice dentro la classe UserService

  /**
   * Recupera statistiche dettagliate per un singolo campo di opinione.
   */
        public static async getOpinionDetailStats(opinionField: string): Promise<any> {
          try {
            if (!adminDb) {
              console.error("Admin SDK non inizializzato.");
              return {};
            }

            // Selezioniamo solo i campi che ci servono per le statistiche
            const snapshot = await adminDb.collection('utenti').select(opinionField, 'genere', 'eta', 'regione_residenza').get();
            if (snapshot.empty) return {};

            // Nuova struttura dati per contenere tutte le suddivisioni
            const stats = {
              gender: {} as Record<string, { favorevole: number; contrario: number; astenuto: number }>,
              age: {} as Record<string, { favorevole: number; contrario: number; astenuto: number }>,
              location: {} as Record<string, { favorevole: number; contrario: number; astenuto: number }>
            };

            // Funzione helper interna per incrementare i contatori
            const incrementStat = (obj: Record<string, any>, key: string, opinion: string) => {
              if (!obj[key]) {
                obj[key] = { favorevole: 0, contrario: 0, astenuto: 0 };
              }
              obj[key][opinion]++;
            };

            // Cicla sui documenti per calcolare le statistiche
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              const opinionValue = data[opinionField];
              if (typeof opinionValue !== 'string') return;

              const normalizedOpinion = (opinionValue === 'Indeciso' ? 'astenuto' : opinionValue.toLowerCase());
              if (!['favorevole', 'contrario', 'astenuto'].includes(normalizedOpinion)) return;

              const gender = (data.genere || 'Non specificato').toLowerCase();
              const ageCategory = getAgeCategory(data.eta);
              const location = data.regione_residenza || 'Non specificato';

              incrementStat(stats.gender, gender, normalizedOpinion);
              incrementStat(stats.age, ageCategory, normalizedOpinion);
              incrementStat(stats.location, location, normalizedOpinion);
            });

            return stats;
          } catch (error) {
            this.handleError(error, 'getOpinionDetailStats');
            return {};
          }
        }
      };

      // Cicla sui documenti per calcolare le statistiche
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const opinion = data[opinionField];
        const gender = (data.genere || 'Non specificato').toLowerCase(); // Normalizziamo il genere

        if (typeof opinion === 'string') {
          const normalizedOpinion = opinion.toLowerCase();

          if (normalizedOpinion === 'favorevole') {
            stats.genderDistributionByOpinion.favorevole[gender] = (stats.genderDistributionByOpinion.favorevole[gender] || 0) + 1;
          } else if (normalizedOpinion === 'contrario') {
            stats.genderDistributionByOpinion.contrario[gender] = (stats.genderDistributionByOpinion.contrario[gender] || 0) + 1;
          } else if (normalizedOpinion === 'astenuto' || normalizedOpinion === 'indeciso') {
            stats.genderDistributionByOpinion.astenuto[gender] = (stats.genderDistributionByOpinion.astenuto[gender] || 0) + 1;
          }
        }
      });

      return stats;
    } catch (error) {
      this.handleError(error, 'getOpinionDetailStats');
      return {};
    }
  }
}

export default UserService;