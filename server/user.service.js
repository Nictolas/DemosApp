// Importa ANCHE l'adminDb e i tipi necessari
import { db, adminDb } from '../api/firebase-config.js';
import { collection, doc, getDoc, setDoc, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import FirebaseService from './firebase-service.js';

class UserService extends FirebaseService {

  static async saveUserData(userData) {
    try {
      if (!db || !userData.uid) return { success: false, error: "DB non configurato o uid mancante" };
      const userDocRef = doc(db, 'utenti', userData.uid);
      const dataToSave = { ...userData, id: userData.uid, updatedAt: new Date().toISOString() };
      if (!dataToSave.createdAt) { dataToSave.createdAt = new Date().toISOString(); }
      await setDoc(userDocRef, dataToSave, { merge: true });
      return { success: true, data: dataToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserData');
    }
  }

  static async updateUserData(uid, userData) {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const userDocRef = doc(db, 'utenti', uid);
      const dataToUpdate = { ...userData, updatedAt: new Date().toISOString() };
      await updateDoc(userDocRef, dataToUpdate);
      return { success: true, data: dataToUpdate };
    } catch (error) {
      return this.handleError(error, 'updateUserData');
    }
  }

  /**
   * Recupera un utente in modo robusto tramite il suo ID, UID o email.
   * @param identifier L'identificatore univoco dell'utente.
   */
  static async getUserById(identifier) {
    if (!db || !identifier) return null;

    // 1. Prova a ottenere il documento tramite ID diretto (il più veloce).
    const userDocRef = doc(db, 'utenti', identifier);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }

    // 2. Se non trovato, prova a cercare per campo 'uid' (Firebase Auth UID).
    let q = query(collection(db, 'utenti'), where('uid', '==', identifier));
    let querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    // 3. Come ultima risorsa, prova a cercare per campo 'email'.
    q = query(collection(db, 'utenti'), where('email', '==', identifier));
    querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    return null; // Utente non trovato con nessun metodo.
  }

  static async getAllUsers() {
    try {
      if (!adminDb) {
          console.error("Admin SDK non inizializzato. Impossibile recuperare tutti gli utenti.");
          return [];
      }
      const snapshot = await adminDb.collection('utenti').get();
      if (snapshot.empty) {
        return [];
      }
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      this.handleError(error, 'getAllUsers');
      return [];
    }
  }

  static async saveUserOpinions(uid, opinions) {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const userDocRef = doc(db, 'utenti', uid);
      const opinionsToSave = { ...opinions, updatedAt: new Date().toISOString() };
      await setDoc(userDocRef, opinionsToSave, { merge: true });
      return { success: true, data: opinionsToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserOpinions');
    }
  }

  static async getUserOpinions(uid) {
    const user = await this.getUserById(uid);
    if (!user) return null;
    return {
      energia_nucleare: user.energia_nucleare,
      sperimentazione_animale: user.sperimentazione_animale,
      legalizzazione_canapa: user.legalizzazione_canapa,
      caccia: user.caccia,
      unione_europea: user.unione_europea,
    };
  }

  static async getCandidati() {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => 
      user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico'
    );
  }

  static async searchPoliticians(searchTerm) {
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
  static async getOpinionDetailStats(opinionField, regione) {
    try {
      if (!adminDb) {
        console.error("Admin SDK non inizializzato, impossibile recuperare statistiche dettagliate.");
        return {};
      }

      const calculateAgeRange = (birthDateString) => {
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

      let firestoreQuery = 
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
          favorevole: {},
          contrario: {},
          astenuto: {}
        },
        ageDistributionByOpinion: {
          favorevole: {},
          contrario: {},
          astenuto: {}
        }
      };

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const opinion = data[opinionField];
        const gender = (data.genere || 'Non specificato').toLowerCase();
        const ageRange = calculateAgeRange(data.data_nascita);

        if (typeof opinion === 'string') {
          const normalizedOpinion = opinion.toLowerCase();
          let targetOpinionGroup = null;
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