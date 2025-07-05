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
      // Recupera i dati attuali
      const userDoc = await getDoc(userDocRef);
      let currentData = userDoc.exists() ? userDoc.data() : {};
      // Se data_nascita non è presente o è vuota, mantieni quella attuale
      let dataToUpdate = { ...userData, updatedAt: new Date().toISOString() };
      if (!('data_nascita' in userData) || !userData.data_nascita) {
        dataToUpdate.data_nascita = currentData.data_nascita || "";
      }
      await updateDoc(userDocRef, dataToUpdate);
      return { success: true, data: dataToUpdate };
    } catch (error) {
      return this.handleError(error, 'updateUserData');
    }
  }

  /**
   * Recupera un utente in modo robusto tramite il suo ID, UID o email.
   * Se trova un documento con chiave email ma campo uid presente, lo migra su chiave uid.
   * @param identifier L'identificatore univoco dell'utente.
   */
  static async getUserById(identifier) {
    if (!db || !identifier) return null;

    // 1. Prova a ottenere il documento tramite ID diretto (il più veloce).
    let userDocRef = doc(db, 'utenti', identifier);
    let userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      // Se la chiave è un'email ma c'è anche il campo uid, migra il documento
      if (identifier.includes('@') && data.uid && data.uid !== identifier) {
        // Copia su nuovo documento con chiave = uid
        const newDocRef = doc(db, 'utenti', data.uid);
        await setDoc(newDocRef, { ...data, id: data.uid });
        await setDoc(userDocRef, { ...data, migrated: true }); // segna il vecchio come migrato
        // Ritorna il nuovo documento
        const migratedDoc = await getDoc(newDocRef);
        if (migratedDoc.exists()) {
          return { id: migratedDoc.id, ...migratedDoc.data() };
        }
      }
      return { id: userDoc.id, ...data };
    }

    // 2. Se non trovato, prova a cercare per campo 'uid' (Firebase Auth UID).
    let q = query(collection(db, 'utenti'), where('uid', '==', identifier));
    let querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }

    // 3. Come ultima risorsa, prova a cercare per campo 'email'.
    q = query(collection(db, 'utenti'), where('email', '==', identifier));
    querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      // Se il documento ha anche un campo uid, migra TUTTI i dati su chiave UID
      if (data.uid && data.uid !== docSnap.id) {
        const newDocRef = doc(db, 'utenti', data.uid);
        // Unisci i dati esistenti su UID (se c'è già un documento)
        let mergedData = { ...data, id: data.uid };
        const existingDoc = await getDoc(newDocRef);
        if (existingDoc.exists()) {
          mergedData = { ...existingDoc.data(), ...data, id: data.uid };
        }
        await setDoc(newDocRef, mergedData);
        await setDoc(docSnap.ref, { ...data, migrated: true });
        // Ritorna il nuovo documento
        const migratedDoc = await getDoc(newDocRef);
        if (migratedDoc.exists()) {
          return { id: migratedDoc.id, ...migratedDoc.data() };
        }
      }
      return { id: docSnap.id, ...data };
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
      // PATCH: Se il documento con UID non esiste, ma esiste quello con email, migra prima di aggiornare
      let userDocRef = doc(db, 'utenti', uid);
      let userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        // Cerca per campo email
        let q = query(collection(db, 'utenti'), where('email', '==', uid));
        let querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data();
          if (data.uid && data.uid !== docSnap.id) {
            // Unisci i dati esistenti su UID (se c'è già un documento)
            const newDocRef = doc(db, 'utenti', data.uid);
            let mergedData = { ...data, id: data.uid };
            const existingDoc = await getDoc(newDocRef);
            if (existingDoc.exists()) {
              mergedData = { ...existingDoc.data(), ...data, id: data.uid };
            }
            await setDoc(newDocRef, mergedData);
            await setDoc(docSnap.ref, { ...data, migrated: true });
            userDocRef = newDocRef;
          }
        }
      }
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
   * Può essere filtrato per regione, provincia e comune.
   */
  static async getOpinionDetailStats(opinionField, regione, provincia, comune) {
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
          adminDb.collection('utenti').select(opinionField, 'genere', 'data_nascita', 'regione_residenza', 'provincia_residenza', 'comune_residenza');

      if (regione) {
        firestoreQuery = firestoreQuery.where('regione_residenza', '==', regione);
      }
      if (provincia) {
        firestoreQuery = firestoreQuery.where('provincia_residenza', '==', provincia);
      }
      if (comune) {
        firestoreQuery = firestoreQuery.where('comune_residenza', '==', comune);
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

  static async createUserProfile(uid, userProfile) {
    try {
      if (!db || !uid) return { success: false, error: "DB non configurato o uid mancante" };
      const userDocRef = doc(db, 'utenti', uid);
      const dataToSave = { ...userProfile, id: uid, updatedAt: new Date().toISOString() };
      if (!dataToSave.createdAt) { dataToSave.createdAt = new Date().toISOString(); }
      await setDoc(userDocRef, dataToSave, { merge: true });
      return { success: true, data: dataToSave };
    } catch (error) {
      return this.handleError(error, 'createUserProfile');
    }
  }

  static async saveUserFonti(uid, fonti) {
    try {
      if (!db) return { success: false, error: "Database non configurato" };
      const userDocRef = doc(db, 'utenti', uid);
      await setDoc(userDocRef, { fonti_opinioni: fonti, updatedAt: new Date().toISOString() }, { merge: true });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'saveUserFonti');
    }
  }

  static async getUserFonti(uid) {
    const user = await this.getUserById(uid);
    if (!user) return {};
    return user.fonti_opinioni || {};
  }

} // <-- Chiusura della classe UserService

export default UserService; 