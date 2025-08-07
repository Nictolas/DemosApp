// File: api/sostenitori.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/sostenitori - Recupera le statistiche e la lista dei sostenitori dell'utente loggato
router.get('/', authenticateUser, async (req, res) => {
    const politicoId = req.user.uid;

    try {
        // Query per trovare tutti gli utenti che hanno il politicoId in uno dei campi rappresentante o candidato
        const supportersQuery = `
            SELECT 
                id as uid, nome, cognome, email, genere, data_nascita, comune_residenza,
                CASE WHEN rappresentante_europeo = $1 THEN 'Rapp. Europeo' ELSE NULL END as r1,
                CASE WHEN rappresentante_camera = $1 THEN 'Rapp. Camera' ELSE NULL END as r2,
                CASE WHEN rappresentante_senato = $1 THEN 'Rapp. Senato' ELSE NULL END as r3,
                CASE WHEN rappresentante_regionale = $1 THEN 'Rapp. Regionale' ELSE NULL END as r4,
                CASE WHEN rappresentante_comunale = $1 THEN 'Rapp. Comunale' ELSE NULL END as r5,
                CASE WHEN candidato_europeo = $1 THEN 'Cand. Europeo' ELSE NULL END as c1,
                CASE WHEN candidato_camera = $1 THEN 'Cand. Camera' ELSE NULL END as c2,
                CASE WHEN candidato_senato = $1 THEN 'Cand. Senato' ELSE NULL END as c3,
                CASE WHEN candidato_regionale = $1 THEN 'Cand. Regionale' ELSE NULL END as c4,
                CASE WHEN candidato_comunale = $1 THEN 'Cand. Comunale' ELSE NULL END as c5
            FROM utenti
            WHERE 
                rappresentante_europeo = $1 OR rappresentante_camera = $1 OR rappresentante_senato = $1 OR 
                rappresentante_regionale = $1 OR rappresentante_comunale = $1 OR
                candidato_europeo = $1 OR candidato_camera = $1 OR candidato_senato = $1 OR
                candidato_regionale = $1 OR candidato_comunale = $1;
        `;
        const supportersResult = await pool.query(supportersQuery, [politicoId]);
        
        const supporters = supportersResult.rows.map(row => {
            const supporterRoles = [row.r1, row.r2, row.r3, row.r4, row.r5, row.c1, row.c2, row.c3, row.c4, row.c5].filter(Boolean);
            // Rimuovi le colonne extra
            const { r1, r2, r3, r4, r5, c1, c2, c3, c4, c5, ...supporterData } = row;
            return { ...supporterData, supporterRoles };
        });

        if (supporters.length === 0) {
            return res.json({
                stats: { totalSupporters: 0, genderDistribution: {}, locationDistribution: {}, averageAge: 0, ageDistribution: {} },
                supporters: [],
                supportersPolitico: [],
                supportersCandidato: [],
                supportersBoth: []
            });
        }

        // Calcola statistiche (questa logica ora è sul server!)
        const getAge = (birthDate) => new Date().getFullYear() - new Date(birthDate).getFullYear();
        
        let ageSum = 0;
        const stats = {
            totalSupporters: supporters.length,
            genderDistribution: { Maschio: 0, Femmina: 0, Altro: 0 },
            locationDistribution: {},
            ageDistribution: { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0 }
        };

        supporters.forEach(s => {
            if (s.genere === 'Maschio') stats.genderDistribution.Maschio++;
            else if (s.genere === 'Femmina') stats.genderDistribution.Femmina++;
            else stats.genderDistribution.Altro++;

            if (s.comune_residenza) {
                stats.locationDistribution[s.comune_residenza] = (stats.locationDistribution[s.comune_residenza] || 0) + 1;
            }
            
            if (s.data_nascita) {
                const age = getAge(s.data_nascita);
                ageSum += age;
                if (age <= 25) stats.ageDistribution['18-25']++;
                else if (age <= 35) stats.ageDistribution['26-35']++;
                else if (age <= 45) stats.ageDistribution['36-45']++;
                else if (age <= 55) stats.ageDistribution['46-55']++;
                else if (age <= 65) stats.ageDistribution['56-65']++;
                else stats.ageDistribution['65+']++;
            }
        });
        stats.averageAge = supporters.length > 0 ? ageSum / supporters.length : 0;
        
        // Filtra le liste per tipo (politico, candidato, entrambi)
        const supportersPolitico = supporters.filter(s => s.supporterRoles.some(r => r.startsWith('Rapp.')));
        const supportersCandidato = supporters.filter(s => s.supporterRoles.some(r => r.startsWith('Cand.')));
        const supportersBoth = supporters.filter(s => 
            s.supporterRoles.some(r => r.startsWith('Rapp.')) &&
            s.supporterRoles.some(r => r.startsWith('Cand.'))
        );

        res.json({ stats, supporters, supportersPolitico, supportersCandidato, supportersBoth });

    } catch (error) {
        console.error("Errore GET /api/sostenitori:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

module.exports = router;