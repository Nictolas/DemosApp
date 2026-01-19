const axios = require('axios');
const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// URL base di Parltrack
// Nota: Gli URL esatti possono variare, verifica su parltrack.org
const PARLTRACK_BASE = 'https://parltrack.org/dumps';
const HOWTHEYVOTE_BASE = 'https://howtheyvote.eu';
const HOWTHEYVOTE_GITHUB = 'https://raw.githubusercontent.com/HowTheyVote/data/main';

/**
 * Recupera i voti individuali dei MEP italiani da Parltrack o HowTheyVote
 * per una specifica votazione del PE
 */
async function getVotiMEPItalianiDaParltrack(votazioneIdPE) {
  try {
    console.log(`📡 Recupero voti MEP italiani per votazione: ${votazioneIdPE}`);
    
    // Prova prima con HowTheyVote.eu (più semplice e diretto)
    const votiHowTheyVote = await getVotiDaHowTheyVote(votazioneIdPE);
    if (votiHowTheyVote) {
      return votiHowTheyVote;
    }
    
    // Se HowTheyVote non ha i dati, prova con Parltrack
    // Nota: Parltrack ha dump JSON che possono essere molto grandi
    // Per ora implementiamo una struttura base che può essere estesa
    
    // URL del dump dei voti (da verificare l'URL esatto su parltrack.org)
    const votesUrl = `${PARLTRACK_BASE}/ep_votes.json`;
    
    try {
      const response = await axios.get(votesUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DemosApp-1.0.0'
        },
        timeout: 30000 // 30 secondi
      });
      
      const votesData = response.data;
      
      // Cerca la votazione specifica
      const votazioneTrovata = findVotazioneInParltrack(votesData, votazioneIdPE);
      
      if (!votazioneTrovata) {
        console.log(`⚠️ Votazione ${votazioneIdPE} non trovata in Parltrack`);
        return null;
      }
      
      // Filtra solo i voti dei MEP italiani
      const votiItaliani = filtraVotiItaliani(votazioneTrovata);
      
      return votiItaliani;
      
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`⚠️ Dump Parltrack non disponibile all'URL: ${votesUrl}`);
      } else {
        console.error(`❌ Errore nel recupero dati Parltrack:`, error.message);
      }
      return null;
    }
    
  } catch (error) {
    console.error('❌ Errore generale nel recupero voti:', error);
    return null;
  }
}

/**
 * Prova a recuperare i voti da HowTheyVote.eu
 * HowTheyVote ha dati in formato CSV/JSON su GitHub
 */
async function getVotiDaHowTheyVote(votazioneIdPE) {
  try {
    // HowTheyVote ha un repository GitHub con dati CSV
    // URL: https://github.com/HowTheyVote/data
    // I dati sono organizzati per votazione
    
    // Estrai l'ID della votazione (es: "MTG-PL-2014-01-16-VOT-ITM-345348-13")
    // e prova a costruire l'URL del file JSON/CSV
    
    // Per ora, prova a cercare nel formato standard di HowTheyVote
    // Il formato potrebbe essere: votes/{votazioneId}.json o simile
    
    const voteId = votazioneIdPE.replace(/^eli\/dl\/event\//, '').replace(/\//g, '-');
    const possibleUrls = [
      `${HOWTHEYVOTE_GITHUB}/votes/${voteId}.json`,
      `${HOWTHEYVOTE_GITHUB}/votes/${votazioneIdPE}.json`,
      `${HOWTHEYVOTE_BASE}/api/votes/${voteId}`,
      `${HOWTHEYVOTE_BASE}/api/votes/${votazioneIdPE}`
    ];
    
    for (const url of possibleUrls) {
      try {
        const response = await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 10000
        });
        
        if (response.data) {
          console.log(`✅ Dati trovati su HowTheyVote: ${url}`);
          const votiItaliani = parseHowTheyVoteData(response.data);
          if (votiItaliani && (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0)) {
            return votiItaliani;
          }
        }
      } catch (err) {
        // Continua con il prossimo URL
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('⚠️ Errore nel recupero da HowTheyVote:', error.message);
    return null;
  }
}

/**
 * Parsa i dati di HowTheyVote per estrarre i voti italiani
 */
function parseHowTheyVoteData(data) {
  const voti = {
    favorevoli: [],
    contrari: [],
    astenuti: [],
    assenti: []
  };
  
  // La struttura di HowTheyVote può variare
  // Possibili formati:
  // - Array di {mep, vote, country}
  // - Oggetto con {positions: [{mep, vote, country}]}
  // - Oggetto con {votes: {for: [...], against: [...], ...}}
  
  let positions = [];
  
  if (Array.isArray(data)) {
    positions = data;
  } else if (data.positions && Array.isArray(data.positions)) {
    positions = data.positions;
  } else if (data.votes) {
    // Formato organizzato per tipo di voto
    if (data.votes.for) positions = positions.concat(data.votes.for.map(v => ({...v, vote: 'for'})));
    if (data.votes.against) positions = positions.concat(data.votes.against.map(v => ({...v, vote: 'against'})));
    if (data.votes.abstention) positions = positions.concat(data.votes.abstention.map(v => ({...v, vote: 'abstention'})));
    if (data.votes.absent) positions = positions.concat(data.votes.absent.map(v => ({...v, vote: 'absent'})));
  }
  
  // Filtra solo i MEP italiani
  for (const position of positions) {
    const country = position.country || position.country_code || position.nationality || '';
    if (country.toLowerCase() === 'italy' || country.toLowerCase() === 'it' || country.toLowerCase() === 'italia') {
      const mepInfo = {
        id: position.mep_id || position.id || position.person_id || position.mep?.id,
        nome_completo: position.mep?.name || position.name || position.full_name || position.mep?.full_name || 'Unknown',
        nome: position.mep?.first_name || position.first_name,
        cognome: position.mep?.last_name || position.last_name,
        gruppo_politico: position.group || position.political_group || position.group_name || position.mep?.group
      };
      
      const voteType = (position.vote || position.choice || position.position || '').toLowerCase();
      
      if (voteType === 'for' || voteType === 'yes' || voteType === '1' || voteType === 'favorevole') {
        voti.favorevoli.push(mepInfo);
      } else if (voteType === 'against' || voteType === 'no' || voteType === '-1' || voteType === 'contrario') {
        voti.contrari.push(mepInfo);
      } else if (voteType === 'abstention' || voteType === 'abstain' || voteType === '0' || voteType === 'astenuto') {
        voti.astenuti.push(mepInfo);
      } else if (voteType === 'absent' || voteType === 'didnotvote' || voteType === 'assente') {
        voti.assenti.push(mepInfo);
      }
    }
  }
  
  return voti;
}

/**
 * Cerca una votazione nei dati di Parltrack
 */
function findVotazioneInParltrack(votesData, votazioneIdPE) {
  if (!votesData || !Array.isArray(votesData)) {
    return null;
  }
  
  // Estrai l'ID corto dalla votazione PE
  // Es: "MTG-PL-2014-01-16-VOT-ITM-345348-13" -> "345348-13" o "MTG-PL-2014-01-16-VOT-ITM-345348-13"
  const idParts = votazioneIdPE.split('-');
  const shortId = idParts.length > 0 ? idParts[idParts.length - 1] : null;
  
  // Cerca la votazione per ID o per pattern
  for (const vote of votesData) {
    // Possibili campi in Parltrack: voteid, id, activity_id, ecc.
    if (vote.voteid === votazioneIdPE || 
        vote.voteid === shortId ||
        vote.id === votazioneIdPE ||
        vote.activity_id === votazioneIdPE ||
        (vote.voteid && vote.voteid.includes(shortId)) ||
        (vote.id && vote.id.includes(votazioneIdPE))) {
      return vote;
    }
  }
  
  return null;
}

/**
 * Filtra i voti per includere solo quelli dei MEP italiani
 */
function filtraVotiItaliani(votazione) {
  if (!votazione || !votazione.votes) {
    return {
      favorevoli: [],
      contrari: [],
      astenuti: [],
      assenti: []
    };
  }
  
  const voti = {
    favorevoli: [],
    contrari: [],
    astenuti: [],
    assenti: []
  };
  
  // La struttura di Parltrack può variare
  // Possibili formati:
  // - vote.votes.groups[group][voteType][members]
  // - vote.votes.positions (array di {mep, vote})
  // - vote.votes (oggetto con chiavi per tipo di voto)
  
  if (votazione.votes.positions && Array.isArray(votazione.votes.positions)) {
    // Formato: array di posizioni
    for (const position of votazione.votes.positions) {
      if (position.country === 'Italy' || position.country === 'IT' || position.country_code === 'IT') {
        const mepInfo = {
          id: position.mep_id || position.mep?.id || position.person_id,
          nome_completo: position.mep?.name || position.name || position.full_name,
          nome: position.mep?.first_name || position.first_name,
          cognome: position.mep?.last_name || position.last_name,
          gruppo_politico: position.group || position.political_group || position.group_name
        };
        
        const voteType = (position.vote || position.choice || position.position || '').toLowerCase();
        
        if (voteType === 'for' || voteType === 'favorevole' || voteType === 'yes' || voteType === '1') {
          voti.favorevoli.push(mepInfo);
        } else if (voteType === 'against' || voteType === 'contrario' || voteType === 'no' || voteType === '-1') {
          voti.contrari.push(mepInfo);
        } else if (voteType === 'abstention' || voteType === 'astenuto' || voteType === 'abstain' || voteType === '0') {
          voti.astenuti.push(mepInfo);
        } else if (voteType === 'absent' || voteType === 'assente' || voteType === 'didnotvote') {
          voti.assenti.push(mepInfo);
        }
      }
    }
  } else if (votazione.votes.groups) {
    // Formato: organizzato per gruppi politici
    for (const [groupName, groupData] of Object.entries(votazione.votes.groups)) {
      for (const [voteType, voteData] of Object.entries(groupData)) {
        if (voteData.members && Array.isArray(voteData.members)) {
          for (const member of voteData.members) {
            if (member.country === 'Italy' || member.country === 'IT' || member.country_code === 'IT') {
              const mepInfo = {
                id: member.mep_id || member.id || member.person_id,
                nome_completo: member.name || member.full_name,
                nome: member.first_name,
                cognome: member.last_name,
                gruppo_politico: groupName
              };
              
              const normalizedVoteType = voteType.toLowerCase();
              if (normalizedVoteType === 'for' || normalizedVoteType === 'yes' || normalizedVoteType === 'favorevole') {
                voti.favorevoli.push(mepInfo);
              } else if (normalizedVoteType === 'against' || normalizedVoteType === 'no' || normalizedVoteType === 'contrario') {
                voti.contrari.push(mepInfo);
              } else if (normalizedVoteType === 'abstention' || normalizedVoteType === 'abstain' || normalizedVoteType === 'astenuto') {
                voti.astenuti.push(mepInfo);
              } else if (normalizedVoteType === 'absent' || normalizedVoteType === 'didnotvote' || normalizedVoteType === 'assente') {
                voti.assenti.push(mepInfo);
              }
            }
          }
        }
      }
    }
  }
  
  return voti;
}

/**
 * Salva i voti MEP italiani nel database
 */
async function salvaVotiMEPItaliani(uriVotazione, voti) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parlamento_europeo_voti_nominali (
        id SERIAL PRIMARY KEY,
        uri_votazione TEXT NOT NULL,
        mep_id TEXT NOT NULL,
        nome_mep TEXT NOT NULL,
        cognome_mep TEXT,
        nome_completo TEXT NOT NULL,
        paese VARCHAR(2) NOT NULL DEFAULT 'IT',
        gruppo_politico TEXT,
        voto VARCHAR(20) NOT NULL CHECK (voto IN ('Favorevole', 'Contrario', 'Astenuto', 'Assente')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uri_votazione, mep_id)
      )
    `);
    
    let salvati = 0;
    
    // Salva favorevoli
    for (const mep of voti.favorevoli) {
      try {
        await pool.query(`
          INSERT INTO parlamento_europeo_voti_nominali 
          (uri_votazione, mep_id, nome_mep, cognome_mep, nome_completo, paese, gruppo_politico, voto)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (uri_votazione, mep_id) 
          DO UPDATE SET 
            nome_completo = EXCLUDED.nome_completo,
            gruppo_politico = EXCLUDED.gruppo_politico,
            voto = EXCLUDED.voto,
            updated_at = CURRENT_TIMESTAMP
        `, [
          uriVotazione,
          mep.id || 'unknown',
          mep.nome || '',
          mep.cognome || '',
          mep.nome_completo || 'Unknown',
          'IT',
          mep.gruppo_politico || null,
          'Favorevole'
        ]);
        salvati++;
      } catch (err) {
        console.error(`⚠️ Errore nel salvataggio voto favorevole per ${mep.nome_completo}:`, err.message);
      }
    }
    
    // Salva contrari
    for (const mep of voti.contrari) {
      try {
        await pool.query(`
          INSERT INTO parlamento_europeo_voti_nominali 
          (uri_votazione, mep_id, nome_mep, cognome_mep, nome_completo, paese, gruppo_politico, voto)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (uri_votazione, mep_id) 
          DO UPDATE SET 
            nome_completo = EXCLUDED.nome_completo,
            gruppo_politico = EXCLUDED.gruppo_politico,
            voto = EXCLUDED.voto,
            updated_at = CURRENT_TIMESTAMP
        `, [
          uriVotazione,
          mep.id || 'unknown',
          mep.nome || '',
          mep.cognome || '',
          mep.nome_completo || 'Unknown',
          'IT',
          mep.gruppo_politico || null,
          'Contrario'
        ]);
        salvati++;
      } catch (err) {
        console.error(`⚠️ Errore nel salvataggio voto contrario per ${mep.nome_completo}:`, err.message);
      }
    }
    
    // Salva astenuti
    for (const mep of voti.astenuti) {
      try {
        await pool.query(`
          INSERT INTO parlamento_europeo_voti_nominali 
          (uri_votazione, mep_id, nome_mep, cognome_mep, nome_completo, paese, gruppo_politico, voto)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (uri_votazione, mep_id) 
          DO UPDATE SET 
            nome_completo = EXCLUDED.nome_completo,
            gruppo_politico = EXCLUDED.gruppo_politico,
            voto = EXCLUDED.voto,
            updated_at = CURRENT_TIMESTAMP
        `, [
          uriVotazione,
          mep.id || 'unknown',
          mep.nome || '',
          mep.cognome || '',
          mep.nome_completo || 'Unknown',
          'IT',
          mep.gruppo_politico || null,
          'Astenuto'
        ]);
        salvati++;
      } catch (err) {
        console.error(`⚠️ Errore nel salvataggio voto astenuto per ${mep.nome_completo}:`, err.message);
      }
    }
    
    // Salva assenti
    for (const mep of voti.assenti) {
      try {
        await pool.query(`
          INSERT INTO parlamento_europeo_voti_nominali 
          (uri_votazione, mep_id, nome_mep, cognome_mep, nome_completo, paese, gruppo_politico, voto)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (uri_votazione, mep_id) 
          DO UPDATE SET 
            nome_completo = EXCLUDED.nome_completo,
            gruppo_politico = EXCLUDED.gruppo_politico,
            voto = EXCLUDED.voto,
            updated_at = CURRENT_TIMESTAMP
        `, [
          uriVotazione,
          mep.id || 'unknown',
          mep.nome || '',
          mep.cognome || '',
          mep.nome_completo || 'Unknown',
          'IT',
          mep.gruppo_politico || null,
          'Assente'
        ]);
        salvati++;
      } catch (err) {
        console.error(`⚠️ Errore nel salvataggio voto assente per ${mep.nome_completo}:`, err.message);
      }
    }
    
    console.log(`✅ Salvati ${salvati} voti MEP italiani nel database`);
    return salvati;
    
  } catch (error) {
    console.error('❌ Errore nel salvataggio voti MEP italiani:', error);
    throw error;
  }
}

module.exports = {
  getVotiMEPItalianiDaParltrack,
  salvaVotiMEPItaliani
};
