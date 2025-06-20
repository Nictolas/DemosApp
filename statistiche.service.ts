app.get('/api/statistiche-personali', requireAuth, async (req, res) => {
  try {
    const politicianId = req.user.id; // Ottieni l'ID del politico loggato dal middleware

    // 1. Conta il totale dei sostenitori
    const [totalResult] = await db.select({ value: count() })
                                  .from(sostenitori)
                                  .where(eq(sostenitori.politicoId, politicianId));
    const totalSostenitori = totalResult.value;

    // 2. Ottieni i dati per calcolare le distribuzioni
    const sostenitoriData = await db.select({ 
                                      genere: sostenitori.genere, 
                                      data_nascita: sostenitori.dataNascita 
                                    })
                                    .from(sostenitori)
                                    .where(eq(sostenitori.politicoId, politicianId));

    // 3. Calcola la distribuzione di genere
    const genderDistribution = sostenitoriData.reduce((acc, curr) => {
      const gender = curr.genere || 'Non specificato';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});

    // 4. Calcola la distribuzione di età
    const ageDistribution = {
      '18-25': 0,
      '26-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0,
      'Non specificata': 0,
    };

    const now = new Date();
    sostenitoriData.forEach(sostenitore => {
      if (!sostenitore.data_nascita) {
        ageDistribution['Non specificata']++;
        return;
      }
      const birthDate = new Date(sostenitore.data_nascita);
      let age = now.getFullYear() - birthDate.getFullYear();
      const m = now.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age >= 18 && age <= 25) ageDistribution['18-25']++;
      else if (age >= 26 && age <= 35) ageDistribution['26-35']++;
      else if (age >= 36 && age <= 50) ageDistribution['36-50']++;
      else if (age >= 51 && age <= 65) ageDistribution['51-65']++;
      else if (age > 65) ageDistribution['65+']++;
    });

    res.json({
      totalSostenitori,
      genderDistribution,
      ageDistribution,
    });

  } catch (error) {
    console.error("Errore nel recuperare le statistiche:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});