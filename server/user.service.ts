// Importa ANCHE l'adminDb e i tipi necessari
import { db, adminDb } from './firebase-config.js';
import { collection, doc, getDoc, setDoc, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import type * as admin from 'firebase-admin';
import { Utente, UserOpinions } from './types.js';
import { FirebaseService } from './firebase-service.js';

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
      if (!adminDb) {
        console.error("Admin SDK non inizializzato, impossibile recuperare utente per email.");
        return null;
      }
      
      const emailId = this.emailToId(email);
      const userDocRef = adminDb.collection('utenti').doc(emailId);
      const docSnap = await userDocRef.get();
      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() } as Utente;
      }
      
      const q = adminDb.collection('utenti').where('email', '==', email).limit(1);
      const querySnapshot = await q.get();
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Utente;
      }

      return null;
    } catch (error) {
      this.handleError(error, 'getUserByEmail');
      return null;
    }
  }

  public static async getAllUsers(): Promise<Utente[]> {
    try {
      if (!adminDb) {
          console.error("Admin SDK non inizializzato. Impossibile recuperare tutti gli utenti.");
          return [];
      }
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

  /**
   * Recupera statistiche dettagliate per un singolo campo di opinione.
   * Può essere filtrato per regione.
   */
  public static async getOpinionDetailStats(opinionField: string, regione?: string): Promise<any> {
    try {
      if (!adminDb) {
        console.error("Admin SDK non inizializzato, impossibile recuperare statistiche dettagliate.");
        return {};
      }

      const calculateAgeRange = (birthDateString: string): string | undefined => {
        if (!birthDateString) return undefined;
        const birthDate = new Date(birthDateString);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age >= 18 && age <= 24) return '18-24';
        if (age >= 25 && age <= 34) return '25-34';
        if (age >= 35 && age <= 44) return '35-44';
        if (age >= 45 && age <= 54) return '45-54';
        if (age >= 55 && age <= 64) return '55-64';
        if (age >= 65) return '65+';
        return undefined;
      };

      let firestoreQuery: admin.firestore.Query = 
          adminDb.collection('utenti').select(opinionField, 'genere', 'data_nascita', 'regione_residenza');

      if (regione) {
        firestoreQuery = firestoreQuery.where('regione_residenza', '==', regione);
      }

      const snapshot = await firestoreQuery.get();

      if (snapshot.empty) {
        return { 
          genderDistributionByOpinion: { favorevole: {}, contrario: {}, astenuto: {} },
          ageDistributionByOpinion: { favorevole: {}, contrario: {}, astenuto: {} }
        };
      }

      const stats = {
        genderDistributionByOpinion: {
          favorevole: {} as Record<string, number>,
          contrario: {} as Record<string, number>,
          astenuto: {} as Record<string, number>
        },
        ageDistributionByOpinion: {
          favorevole: {} as Record<string, number>,
          contrario: {} as Record<string, number>,
          astenuto: {} as Record<string, number>
        }
      };

      snapshot.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>) => {
        const data = doc.data();
        const opinion = data[opinionField];
        const gender = (data.genere || 'Non specificato').toLowerCase();
        const ageRange = calculateAgeRange(data.data_nascita);

        if (typeof opinion === 'string') {
          const normalizedOpinion = opinion.toLowerCase();
          let targetOpinionGroup: keyof typeof stats.genderDistributionByOpinion | null = null;
          if (normalizedOpinion === 'favorevole') targetOpinionGroup = 'favorevole';
          else if (normalizedOpinion === 'contrario') targetOpinionGroup = 'contrario';
          else if (normalizedOpinion === 'astenuto' || normalizedOpinion === 'indeciso') targetOpinionGroup = 'astenuto';

          if (targetOpinionGroup) {
            stats.genderDistributionByOpinion[targetOpinionGroup][gender] = (stats.genderDistributionByOpinion[targetOpinionGroup][gender] || 0) + 1;
            if (ageRange) {
              stats.ageDistributionByOpinion[targetOpinionGroup][ageRange] = (stats.ageDistributionByOpinion[targetOpinionGroup][ageRange] || 0) + 1;
            }
          }
        }
      });

      return stats;
    } catch (error) {
      this.handleError(error, 'getOpinionDetailStats');
      return {};
    }
  }

} // <-- Chiusura della classe UserService

export default UserService;