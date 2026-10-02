// Importa ANCHE l'adminDb e i tipi necessari
import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

class UserService {

  static async saveUserData(userData) {
    try {
      if (!pool || !userData.uid) return { success: false, error: "DB non configurato o uid mancante" };
      
      const dataToSave = { ...userData, id: userData.uid, updatedAt: new Date().toISOString() };
      if (!dataToSave.createdAt) { dataToSave.createdAt = new Date().toISOString(); }
      
      // Prepara i campi per l'inserimento/aggiornamento nella tabella utenti
      const fields = Object.keys(dataToSave);
      const values = Object.values(dataToSave);
      const placeholders = fields.map(() => '?').join(', ');
      const updateClause = fields.map(field => `${field} = VALUES(${field})`).join(', ');
      
      const query = `
        INSERT INTO utenti (${fields.join(', ')}) 
        VALUES (${placeholders}) 
        ON DUPLICATE KEY UPDATE ${updateClause}
      `;
      
      const [result] = await pool.execute(query, values);
      return { success: true, data: dataToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserData');
    }
  }

  static async updateUserData(uid, userData) {
    try {
      if (!pool) return { success: false, error: "Database non configurato" };
      
      // Recupera i dati attuali dal database MySQL
      const [rows] = await pool.execute('SELECT * FROM utenti WHERE id = ?', [uid]);
      let currentData = rows[0] ? rows[0] : {};
      
      // Se data_nascita non è presente o è vuota, mantieni quella attuale
      let dataToUpdate = { ...userData, updatedAt: new Date().toISOString() };
      if (!('data_nascita' in userData) || !userData.data_nascita) {
        dataToUpdate.data_nascita = currentData.data_nascita || "";
      }
      
      // Aggiorna i dati nel database MySQL
      const fields = Object.keys(dataToUpdate);
      const values = Object.values(dataToUpdate);
      const updateClause = fields.map(field => `${field} = ?`).join(', ');
      
      const query = `UPDATE utenti SET ${updateClause} WHERE id = ?`;
      const [result] = await pool.execute(query, [...values, uid]);
      
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
    if (!pool || !identifier) return null;

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
      // Usa solo Firestore
      const snapshot = await adminDb.collection('utenti').get();
      if (snapshot.empty) {
        return [];
      }
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Errore Firestore:", error);
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
    // Recupera la lista delle domande dinamiche
    let opinioniList = [];
    try {
      const res = await import('../api/opinioni.service.js');
      if (res && res.default && typeof res.default.listOpinioni === 'function') {
        opinioniList = await res.default.listOpinioni();
      }
    } catch (e) {
      // fallback: nessuna domanda dinamica
    }
    // Restituisci tutte le opinioni (vecchie e nuove)
    const opinioni = {};
    for (const key of Object.keys(user)) {
      if (opinioniList.find(q => q.id === key) || [
        'energia_nucleare',
        'sperimentazione_animale',
        'legalizzazione_canapa',
        'caccia'
      ].includes(key)) {
        opinioni[key] = user[key];
      }
    }
    return opinioni;
  }

  static async getCandidati() {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => 
      user.ruolo === "C" || user.ruolo === "CP"
    );
  }

  static async searchPoliticians(searchTerm) {
    const allUsers = await this.getAllUsers();
    const q = searchTerm.toLowerCase();
    return allUsers.filter(user =>
      (user.ruolo === "P" || user.ruolo === "C" || user.ruolo === "CP") &&
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