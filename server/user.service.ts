// Sostituisci la vecchia funzione con questa
public static async getOpinionDetailStats(opinionField: string, regione?: string): Promise<any> {
  try {
    if (!adminDb) {
      console.error("Admin SDK non inizializzato, impossibile recuperare statistiche dettagliate.");
      return {};
    }

    // La funzione helper 'calculateAgeRange' rimane identica
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

    // Costruiamo la query in modo dinamico
    let firestoreQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = 
        adminDb.collection('utenti').select(opinionField, 'genere', 'data_nascita', 'regione_residenza');

    // Aggiungiamo il filtro per la regione solo se è stato fornito
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

    // La struttura 'stats' rimane identica
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

    // Il ciclo 'forEach' per calcolare le statistiche rimane identico
    snapshot.docs.forEach(doc => {
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