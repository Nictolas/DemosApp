// Import delle configurazioni e tipi
import { db } from '../api/firebase-config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Utente } from 'api/types';

class SostenitoriService {
  /**
   * Calcola le statistiche dei sostenitori per un politico/candidato dato l'email.
   */
  public static async getSupporterStats(email: string) {
    if (!db) return null;

    // Trova l'utente (politico/candidato) tramite email
    const utentiSnapshot = await getDocs(query(collection(db, 'utenti'), where('email', '==', email)));
    if (utentiSnapshot.empty) return null;
    const user = utentiSnapshot.docs[0].data() as Utente;
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
    const locationDistribution: Record<string, number> = {};
    let ageSum = 0;
    const ageDistribution = {
      '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0
    };

    const getAge = (birthDate: string) => {
      if (!birthDate) return null;
      const birth = new Date(birthDate);
      const now = new Date();
      return now.getFullYear() - birth.getFullYear();
    };

    for (const s of supporters) {
      // Genere
      if (s.genere === 'Maschio') genderDistribution.Maschio++;
      else if (s.genere === 'Femmina') genderDistribution.Femmina++;
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
}

export default SostenitoriService; 