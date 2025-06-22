// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { adminDb } from './firebase-config.js';

// Import necessari da 'firebase/firestore'
import { collection, getDocs, query, where } from 'firebase/firestore';

type SupporterStats = {
  totalSupporters: number;
  genderDistribution: {
    Maschio: number;
    Femmina: number;
    Altro: number;
  };
  locationDistribution: Record<string, number>;
  averageAge: number;
  ageDistribution: {
    '18-25': number;
    '26-35': number;
    '36-45': number;
    '46-55': number;
    '56-65': number;
    '65+': number;
  };
};

class SostenitoriService extends FirebaseService {

  /**
   * Calcola le statistiche dei sostenitori per un politico/candidato
   * @param politicianEmail Email del politico/candidato
   */
  public static async getSupporterStats(politicianEmail: string): Promise<SupporterStats> {
    try {
      if (!adminDb) {
        throw new Error('Database non configurato');
      }

      // Recupera tutti gli utenti
      const usersRef = collection(adminDb, 'utenti');
      const usersSnapshot = await getDocs(usersRef);
      
      const supporters: any[] = [];
      
      // Filtra i sostenitori (utenti che hanno votato per questo politico)
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // Controlla se l'utente ha votato per questo politico
        // Verifica nei vari campi di candidato/rappresentante
        const hasVotedForPolitician = 
          userData.candidato_europeo === politicianEmail ||
          userData.candidato_camera === politicianEmail ||
          userData.candidato_senato === politicianEmail ||
          userData.candidato_regione === politicianEmail ||
          userData.candidato_comune === politicianEmail ||
          userData.rappresentante_europeo === politicianEmail ||
          userData.rappresentante_camera === politicianEmail ||
          userData.rappresentante_senato === politicianEmail ||
          userData.rappresentante_regione === politicianEmail ||
          userData.rappresentante_comune === politicianEmail;

        if (hasVotedForPolitician) {
          supporters.push(userData);
        }
      });

      // Calcola le statistiche
      const stats = this.calculateStats(supporters);
      
      return stats;
      
    } catch (error) {
      console.error('Errore nel calcolare le statistiche dei sostenitori:', error);
      throw error;
    }
  }

  /**
   * Calcola le statistiche dai dati dei sostenitori
   */
  private static calculateStats(supporters: any[]): SupporterStats {
    const totalSupporters = supporters.length;
    
    // Distribuzione per genere
    const genderDistribution = {
      Maschio: 0,
      Femmina: 0,
      Altro: 0
    };

    // Distribuzione per età
    const ageDistribution = {
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-55': 0,
      '56-65': 0,
      '65+': 0
    };

    // Distribuzione per località
    const locationDistribution: Record<string, number> = {};
    
    let totalAge = 0;
    let ageCount = 0;

    supporters.forEach((supporter) => {
      // Genere
      if (supporter.genere) {
        const gender = supporter.genere.toLowerCase();
        if (gender === 'maschio' || gender === 'm') {
          genderDistribution.Maschio++;
        } else if (gender === 'femmina' || gender === 'f') {
          genderDistribution.Femmina++;
        } else {
          genderDistribution.Altro++;
        }
      }

      // Età
      if (supporter.data_nascita) {
        try {
          const birthDate = new Date(supporter.data_nascita);
          const age = new Date().getFullYear() - birthDate.getFullYear();
          totalAge += age;
          ageCount++;

          if (age >= 18 && age <= 25) ageDistribution['18-25']++;
          else if (age >= 26 && age <= 35) ageDistribution['26-35']++;
          else if (age >= 36 && age <= 45) ageDistribution['36-45']++;
          else if (age >= 46 && age <= 55) ageDistribution['46-55']++;
          else if (age >= 56 && age <= 65) ageDistribution['56-65']++;
          else if (age > 65) ageDistribution['65+']++;
        } catch (error) {
          console.warn('Data di nascita non valida:', supporter.data_nascita);
        }
      }

      // Località
      const location = this.getLocationString(supporter);
      if (location) {
        locationDistribution[location] = (locationDistribution[location] || 0) + 1;
      }
    });

    const averageAge = ageCount > 0 ? totalAge / ageCount : 0;

    return {
      totalSupporters,
      genderDistribution,
      locationDistribution,
      averageAge,
      ageDistribution
    };
  }

  /**
   * Crea una stringa di località dall'utente
   */
  private static getLocationString(user: any): string {
    const parts = [];
    
    if (user.comune_residenza) parts.push(user.comune_residenza);
    if (user.provincia_residenza) parts.push(user.provincia_residenza);
    if (user.regione_residenza) parts.push(user.regione_residenza);
    if (user.paese_residenza) parts.push(user.paese_residenza);
    
    return parts.length > 0 ? parts.join(', ') : 'Località non specificata';
  }
}

export default SostenitoriService; 