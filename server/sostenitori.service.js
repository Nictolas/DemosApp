import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class SostenitoriService {
  /**
   * Calcola le statistiche dei sostenitori per un politico/candidato dato l'email.
   */
  static async getSupporterStats(identifier) {
    if (!db) return null;

    let utentiSnapshot;
    if (identifier.includes('@')) {
      // Cerca per email
      utentiSnapshot = await getDocs(query(collection(db, 'utenti'), where('email', '==', identifier)));
    } else {
      // Cerca per uid
      utentiSnapshot = await getDocs(query(collection(db, 'utenti'), where('uid', '==', identifier)));
    }
    if (utentiSnapshot.empty) return null;
    const user = utentiSnapshot.docs[0].data();
    const userId = user.uid || utentiSnapshot.docs[0].id;

    // Trova tutti gli utenti che hanno scelto questo userId come rappresentante in almeno un campo
    const allUsersSnapshot = await getDocs(collection(db, 'utenti'));
    const supporters = [];
    for (const doc of allUsersSnapshot.docs) {
      const u = doc.data();
      if (
        u.rappresentante_europeo === userId ||
        u.rappresentante_camera === userId ||
        u.rappresentante_senato === userId ||
        u.rappresentante_regionale === userId ||
        u.rappresentante_comunale === userId
      ) {
        supporters.push(u);
      }
    }

    // Calcola statistiche
    const totalSupporters = supporters.length;
    const genderDistribution = { Maschio: 0, Femmina: 0, Altro: 0 };
    const locationDistribution = {};
    let ageSum = 0;
    const ageDistribution = {
      '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0
    };

    const getAge = (birthDate) => {
      if (!birthDate) return null;
      const birth = new Date(birthDate);
      const now = new Date();
      return now.getFullYear() - birth.getFullYear();
    };

    for (const s of supporters) {
      // Genere (case-insensitive, mapping)
      const genere = (s.genere || '').trim().toLowerCase();
      if (genere === 'maschio' || genere === 'uomo') genderDistribution.Maschio++;
      else if (genere === 'femmina' || genere === 'donna') genderDistribution.Femmina++;
      else genderDistribution.Altro++;

      // Località
      if (s.comune_residenza) {
        locationDistribution[s.comune_residenza] = (locationDistribution[s.comune_residenza] || 0) + 1;
      }

      // Età
      const age = getAge(s.data_nascita);
      if (age) {
        ageSum += age;
        if (age <= 25) ageDistribution['18-25']++;
        else if (age <= 35) ageDistribution['26-35']++;
        else if (age <= 45) ageDistribution['36-45']++;
        else if (age <= 55) ageDistribution['46-55']++;
        else if (age <= 65) ageDistribution['56-65']++;
        else ageDistribution['65+']++;
      }
    }

    const averageAge = totalSupporters > 0 ? ageSum / totalSupporters : 0;

    return {
      totalSupporters,
      genderDistribution,
      locationDistribution,
      averageAge,
      ageDistribution
    };
  }

  /**
   * Ottiene la lista dettagliata dei sostenitori per un politico/candidato.
   */
  static async getSupportersList(identifier) {
    if (!db) return null;

    let utentiSnapshot;
    if (identifier.includes('@')) {
      // Cerca per email
      utentiSnapshot = await getDocs(query(collection(db, 'utenti'), where('email', '==', identifier)));
    } else {
      // Cerca per uid
      utentiSnapshot = await getDocs(query(collection(db, 'utenti'), where('uid', '==', identifier)));
    }
    if (utentiSnapshot.empty) return null;
    const user = utentiSnapshot.docs[0].data();
    const userId = user.uid || utentiSnapshot.docs[0].id;

    // Trova tutti gli utenti che hanno scelto questo userId come rappresentante in almeno un campo
    const allUsersSnapshot = await getDocs(collection(db, 'utenti'));
    const supporters = [];
    
    for (const doc of allUsersSnapshot.docs) {
      const u = doc.data();
      const supporterRoles = [];
      
      if (u.rappresentante_europeo === userId) supporterRoles.push('Rappresentante Europeo');
      if (u.rappresentante_camera === userId) supporterRoles.push('Rappresentante Camera');
      if (u.rappresentante_senato === userId) supporterRoles.push('Rappresentante Senato');
      if (u.rappresentante_regionale === userId) supporterRoles.push('Rappresentante Regionale');
      if (u.rappresentante_comunale === userId) supporterRoles.push('Rappresentante Comunale');
      
      if (supporterRoles.length > 0) {
        supporters.push({
          ...u,
          supporterRoles,
          data_registrazione: u.data_registrazione || doc.id // fallback se non c'è data_registrazione
        });
      }
    }

    // Ordina per data di registrazione (più recenti prima)
    supporters.sort((a, b) => {
      const dateA = new Date(a.data_registrazione);
      const dateB = new Date(b.data_registrazione);
      return dateB - dateA;
    });

    return supporters;
  }
}

export default SostenitoriService; 