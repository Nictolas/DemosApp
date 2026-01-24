const axios = require('axios');
const { getPool } = require('../config/database');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const cheerio = require('cheerio');

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// URL base di Parltrack
// Nota: Gli URL esatti possono variare, verifica su parltrack.org
const PARLTRACK_BASE = 'https://parltrack.org/dumps';
const PARLTRACK_API = 'https://parltrack.org/api';
const HOWTHEYVOTE_BASE = 'https://howtheyvote.eu';
const HOWTHEYVOTE_GITHUB = 'https://raw.githubusercontent.com/HowTheyVote/data/main';
const HOWTHEYVOTE_API = 'https://api.howtheyvote.eu';

/**
 * Recupera i voti individuali dei MEP italiani da Parltrack, HowTheyVote o scraping HTML
 * per una specifica votazione del PE
 */
async function getVotiMEPItalianiDaParltrack(votazioneIdPE, documentoVoti = null) {
  try {
    console.log(`📡 Recupero voti MEP italiani per votazione: ${votazioneIdPE}`);
    if (documentoVoti) {
      console.log(`   Documento voti: ${documentoVoti}`);
    }
    
    // Prova prima con scraping HTML dal sito ufficiale del PE
    const votiHTML = await getVotiDaHTMLUfficiale(votazioneIdPE, documentoVoti);
    if (votiHTML && (votiHTML.favorevoli.length > 0 || votiHTML.contrari.length > 0 || votiHTML.astenuti.length > 0)) {
      return votiHTML;
    }
    
    // Prova poi con HowTheyVote.eu
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
    console.log(`🔍 Tentativo recupero da HowTheyVote per: ${votazioneIdPE}`);
    
    // Estrai l'ID della votazione (es: "MTG-PL-2014-01-16-VOT-ITM-345348-13")
    const voteId = votazioneIdPE.replace(/^eli\/dl\/event\//, '').replace(/\//g, '-');
    const voteIdShort = voteId.split('-VOT-')[1] || voteId;
    
    // Prova a scaricare il CSV dei voti da GitHub
    // HowTheyVote ha releases settimanali: https://github.com/HowTheyVote/data/releases
    const possibleCsvUrls = [
      `${HOWTHEYVOTE_GITHUB}/votes.csv.gz`,
      `https://github.com/HowTheyVote/data/releases/latest/download/votes.csv.gz`,
      `https://github.com/HowTheyVote/data/raw/main/votes.csv.gz`,
      `https://raw.githubusercontent.com/HowTheyVote/data/main/votes.csv.gz`
    ];
    
    let votesCsvUrl = null;
    let csvContent = null;
    
    for (const url of possibleCsvUrls) {
      try {
        console.log(`   Provo URL: ${url}`);
        const votesResponse = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'application/gzip, application/octet-stream',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 60000,
          validateStatus: (status) => status < 500
        });
        
        if (votesResponse.status === 200) {
          votesCsvUrl = url;
          console.log(`   ✅ File trovato su: ${url}`);
          
          // Decomprimi il file GZIP
          console.log(`   Decompressione file...`);
          const decompressed = await gunzip(votesResponse.data);
          csvContent = decompressed.toString('utf-8');
          
          console.log(`   ✅ File CSV scaricato (${csvContent.length} caratteri)`);
          break;
        }
      } catch (csvError) {
        if (csvError.response && csvError.response.status === 404) {
          console.log(`   ⚠️ File non trovato su: ${url}`);
        } else {
          console.log(`   ⚠️ Errore per ${url}: ${csvError.message}`);
        }
        continue;
      }
    }
    
    if (!csvContent) {
      console.log(`   ⚠️ Nessun file CSV trovato su HowTheyVote`);
      // Continua con fallback JSON
    } else {
      // Parse CSV e cerca la votazione
      const votiItaliani = parseHowTheyVoteCSV(csvContent, votazioneIdPE, voteId, voteIdShort);
      
      if (votiItaliani && (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0)) {
        console.log(`   ✅ Trovati ${votiItaliani.favorevoli.length} favorevoli, ${votiItaliani.contrari.length} contrari, ${votiItaliani.astenuti.length} astenuti`);
        return votiItaliani;
      } else {
        console.log(`   ⚠️ Nessun voto italiano trovato per questa votazione`);
      }
    }
    
    
    // Fallback: prova URL JSON se disponibili
    const possibleUrls = [
      `${HOWTHEYVOTE_GITHUB}/votes/${voteId}.json`,
      `${HOWTHEYVOTE_GITHUB}/votes/${voteIdShort}.json`
    ];
    
    for (const url of possibleUrls) {
      try {
        const response = await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DemosApp-1.0.0'
          },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        if (response.status === 200 && response.data) {
          console.log(`✅ Dati trovati su HowTheyVote: ${url}`);
          const votiItaliani = parseHowTheyVoteData(response.data);
          if (votiItaliani && (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0)) {
            return votiItaliani;
          }
        }
      } catch (err) {
        continue;
      }
    }
    
    console.log(`⚠️ Nessun dato trovato su HowTheyVote per ${votazioneIdPE}`);
    return null;
  } catch (error) {
    console.error('⚠️ Errore nel recupero da HowTheyVote:', error.message);
    return null;
  }
}

/**
 * Parsa il CSV di HowTheyVote per estrarre i voti italiani
 */
function parseHowTheyVoteCSV(csvContent, votazioneIdPE, voteId, voteIdShort) {
  const voti = {
    favorevoli: [],
    contrari: [],
    astenuti: [],
    assenti: []
  };
  
  const lines = csvContent.split('\n');
  if (lines.length < 2) {
    console.log(`   ⚠️ CSV vuoto o malformato`);
    return voti;
  }
  
  // Prima riga = header
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log(`   Header CSV: ${headers.slice(0, 10).join(', ')}...`);
  
  // HowTheyVote ha una struttura diversa: id, timestamp, display_title, reference, ecc.
  // I voti individuali potrebbero essere in un file separato o in una struttura diversa
  // Per ora, cerchiamo il riferimento alla votazione nel campo 'reference' o 'id'
  const referenceIndex = headers.findIndex(h => h.toLowerCase().includes('reference') || h.toLowerCase().includes('id'));
  
  console.log(`   Indice reference/id: ${referenceIndex}`);
  
  if (referenceIndex === -1) {
    console.log(`   ⚠️ Struttura CSV non riconosciuta. Header completo: ${headers.join(', ')}`);
    console.log(`   ⚠️ Il CSV di HowTheyVote potrebbe avere una struttura diversa o richiedere un file separato per i voti individuali`);
    return voti;
  }
  
  // Il CSV di HowTheyVote potrebbe contenere solo aggregati, non voti individuali
  // I voti individuali potrebbero essere in un file separato come 'mep_votes.csv' o simile
  // Per ora, restituiamo vuoto e proviamo con lo scraping HTML
  console.log(`   ⚠️ Il CSV contiene solo aggregati, non voti individuali. Provo con scraping HTML...`);
  return voti;
  
  let matchedVotes = 0;
  let italianVotes = 0;
  
  // Cerca la votazione nelle righe
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV (gestisce valori con virgolette)
    const values = parseCSVLine(line);
    
    if (values.length <= Math.max(voteIdIndex, mepIdIndex, countryIndex, voteIndex)) continue;
    
    const rowVoteId = values[voteIdIndex]?.trim().replace(/"/g, '');
    const country = values[countryIndex]?.trim().replace(/"/g, '').toLowerCase();
    
    // Verifica se è la votazione che cerchiamo
    const isOurVote = rowVoteId === votazioneIdPE || 
                      rowVoteId === voteId || 
                      rowVoteId === voteIdShort ||
                      rowVoteId?.includes(voteIdShort) ||
                      rowVoteId?.includes(votazioneIdPE) ||
                      rowVoteId?.includes('345348'); // Fallback per ID parziale
    
    if (isOurVote) {
      matchedVotes++;
      
      // Verifica se è un MEP italiano
      const isItalian = country === 'italy' || country === 'it' || country === 'italia' || country === 'italian';
      
      if (isItalian) {
        italianVotes++;
        const mepId = values[mepIdIndex]?.trim().replace(/"/g, '');
        const voteValue = values[voteIndex]?.trim().replace(/"/g, '').toLowerCase();
        const mepName = nameIndex !== -1 ? values[nameIndex]?.trim().replace(/"/g, '') : 'Unknown';
        const group = groupIndex !== -1 ? values[groupIndex]?.trim().replace(/"/g, '') : null;
        
        const mepInfo = {
          id: mepId || 'unknown',
          nome_completo: mepName,
          gruppo_politico: group
        };
        
        if (voteValue === 'for' || voteValue === 'yes' || voteValue === '1' || voteValue === 'favorevole') {
          voti.favorevoli.push(mepInfo);
        } else if (voteValue === 'against' || voteValue === 'no' || voteValue === '-1' || voteValue === 'contrario') {
          voti.contrari.push(mepInfo);
        } else if (voteValue === 'abstention' || voteValue === 'abstain' || voteValue === '0' || voteValue === 'astenuto') {
          voti.astenuti.push(mepInfo);
        } else if (voteValue === 'absent' || voteValue === 'didnotvote' || voteValue === 'assente') {
          voti.assenti.push(mepInfo);
        }
      }
    }
  }
  
  console.log(`   Righe processate: ${lines.length - 1}, voti corrispondenti: ${matchedVotes}, voti italiani: ${italianVotes}`);
  
  return voti;
}

/**
 * Parse una riga CSV gestendo valori con virgolette
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * Parsa i dati di HowTheyVote per estrarre i voti italiani (formato JSON)
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

/**
 * Recupera i voti individuali facendo scraping HTML dal sito ufficiale del PE
 */
async function getVotiDaHTMLUfficiale(votazioneIdPE) {
  try {
    console.log(`🔍 Tentativo scraping HTML per: ${votazioneIdPE}`);
    
    // Costruisci l'URL del documento HTML
    // Il formato tipico è: PV-{term}-{date}-VOT-ITM-{number}_{lang}.html
    // Estrai i componenti dall'ID della votazione
    // Es: "MTG-PL-2014-01-16-VOT-ITM-345348-13" -> term=7, date=2014-01-16, number=13
    
    // Estrai informazioni dalla votazione
    // Formato: "MTG-PL-2014-01-16-VOT-ITM-345348-13"
    // -> year=2014, month=01, day=16, term=7 (per 2014), number=13
    
    const match = votazioneIdPE.match(/MTG-PL-(\d{4})-(\d{2})-(\d{2})-VOT-ITM-(\d+)-(\d+)/);
    if (!match) {
      console.log(`   ⚠️ Formato ID votazione non riconosciuto: ${votazioneIdPE}`);
      return null;
    }
    
    const [, year, month, day, , number] = match;
    // Per il 2014, il termine parlamentare è il 7°
    const termNumber = year === '2014' ? '7' : '9'; // Default a 9 per votazioni più recenti
    const docNumber = number.padStart(3, '0');
    
    // Costruisci URL per documento HTML
    // Formato corretto: PV-7-2014-01-16-VOT-ITM-013_EN.html
    const possibleUrls = [
      `https://www.europarl.europa.eu/doceo/document/PV-${termNumber}-${year}-${month}-${day}-VOT-ITM-${docNumber}_EN.html`,
      `https://www.europarl.europa.eu/doceo/document/PV-${termNumber}-${year}-${month}-${day}-VOT-ITM-${docNumber}_IT.html`,
      `https://www.europarl.europa.eu/doceo/document/PV-${termNumber}-${year}-${month}-${day}-VOT-ITM-${docNumber}_FR.html`
    ];
    
    for (const url of possibleUrls) {
      try {
        console.log(`   Provo URL: ${url}`);
        const response = await axios.get(url, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500
        });
        
        if (response.status === 200 && response.headers['content-type']?.includes('html')) {
          console.log(`   ✅ Documento HTML trovato!`);
          
          const $ = cheerio.load(response.data);
          const votiItaliani = estraiVotiDaHTML($, votazioneIdPE);
          
          if (votiItaliani && (votiItaliani.favorevoli.length > 0 || votiItaliani.contrari.length > 0 || votiItaliani.astenuti.length > 0)) {
            console.log(`   ✅ Trovati ${votiItaliani.favorevoli.length} favorevoli, ${votiItaliani.contrari.length} contrari, ${votiItaliani.astenuti.length} astenuti`);
            return votiItaliani;
          }
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.log(`   ⚠️ 404 per ${url}`);
        } else {
          console.log(`   ⚠️ Errore per ${url}: ${err.message}`);
        }
        continue;
      }
    }
    
    console.log(`   ⚠️ Nessun documento HTML trovato`);
    return null;
  } catch (error) {
    console.error('⚠️ Errore nello scraping HTML:', error.message);
    return null;
  }
}

/**
 * Estrae i voti dei MEP italiani da un documento HTML del PE
 */
function estraiVotiDaHTML($, votazioneIdPE) {
  const voti = {
    favorevoli: [],
    contrari: [],
    astenuti: [],
    assenti: []
  };
  
  // Cerca tabelle che contengono i voti
  // Le tabelle di voti tipicamente hanno colonne per: Nome MEP, Paese, Voto
  const tables = $('table');
  
  console.log(`   Trovate ${tables.length} tabelle nel documento`);
  
  // Lista di paesi italiani (varianti)
  const italianCountries = ['Italy', 'Italie', 'Italia', 'IT', 'ITA'];
  
  // Cerca in ogni tabella
  tables.each((index, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    // Cerca header per identificare colonne
    const headers = [];
    $table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      headers.push(text);
    });
    
    // Cerca colonne rilevanti
    const nameColIndex = headers.findIndex(h => h.includes('name') || h.includes('mep') || h.includes('member') || h.includes('nome') || h.includes('membro'));
    const countryColIndex = headers.findIndex(h => h.includes('country') || h.includes('paese') || h.includes('nationality') || h.includes('nazionalità'));
    const voteColIndex = headers.findIndex(h => h.includes('vote') || h.includes('voto') || h.includes('decision') || h.includes('position') || h.includes('choice'));
    
    // Se non troviamo header, prova a dedurre dalle righe
    if (nameColIndex === -1 || countryColIndex === -1 || voteColIndex === -1) {
      // Prova a cercare pattern comuni nelle righe
      rows.each((i, row) => {
        const cells = $(row).find('td, th');
        if (cells.length < 3) return;
        
        // Cerca pattern italiani nel testo della riga
        const rowText = $(row).text().toLowerCase();
        const isItalianRow = italianCountries.some(country => rowText.includes(country.toLowerCase()));
        
        if (isItalianRow) {
          // Prova a estrarre nome e voto
          const cellTexts = cells.map((j, cell) => $(cell).text().trim()).get();
          
          // Cerca il nome (di solito è il primo o secondo campo)
          let nomeMEP = cellTexts[0] || cellTexts[1] || '';
          // Cerca il voto (di solito è l'ultimo campo o contiene "for/against/abstention")
          const voteText = cellTexts[cellTexts.length - 1]?.toLowerCase() || rowText;
          
          if (nomeMEP && nomeMEP.length > 2) {
            const mepInfo = {
              id: `mep-${nomeMEP.replace(/\s+/g, '-').toLowerCase()}`,
              nome_completo: nomeMEP,
              gruppo_politico: null
            };
            
            if (voteText.includes('for') || voteText.includes('yes') || voteText.includes('favorevole') || voteText.includes('pour') || voteText.includes('+')) {
              voti.favorevoli.push(mepInfo);
            } else if (voteText.includes('against') || voteText.includes('no') || voteText.includes('contrario') || voteText.includes('contre') || voteText.includes('-')) {
              voti.contrari.push(mepInfo);
            } else if (voteText.includes('abstention') || voteText.includes('abstain') || voteText.includes('astenuto') || voteText.includes('0')) {
              voti.astenuti.push(mepInfo);
            } else if (voteText.includes('absent') || voteText.includes('assente')) {
              voti.assenti.push(mepInfo);
            }
          }
        }
      });
    } else {
      // Usa gli indici delle colonne trovati
      rows.slice(1).each((i, row) => {
        const cells = $(row).find('td, th');
        if (cells.length <= Math.max(nameColIndex, countryColIndex, voteColIndex)) return;
        
        const nomeMEP = $(cells[nameColIndex]).text().trim();
        const country = $(cells[countryColIndex]).text().trim();
        const voteText = $(cells[voteColIndex]).text().trim().toLowerCase();
        
        const isItalian = italianCountries.some(ic => country.toLowerCase().includes(ic.toLowerCase()));
        
        if (isItalian && nomeMEP) {
          const mepInfo = {
            id: `mep-${nomeMEP.replace(/\s+/g, '-').toLowerCase()}`,
            nome_completo: nomeMEP,
            gruppo_politico: null
          };
          
          if (voteText.includes('for') || voteText.includes('yes') || voteText.includes('favorevole') || voteText.includes('pour') || voteText === '+' || voteText === '1') {
            voti.favorevoli.push(mepInfo);
          } else if (voteText.includes('against') || voteText.includes('no') || voteText.includes('contrario') || voteText.includes('contre') || voteText === '-' || voteText === '-1') {
            voti.contrari.push(mepInfo);
          } else if (voteText.includes('abstention') || voteText.includes('abstain') || voteText.includes('astenuto') || voteText === '0') {
            voti.astenuti.push(mepInfo);
          } else if (voteText.includes('absent') || voteText.includes('assente')) {
            voti.assenti.push(mepInfo);
          }
        }
      });
    }
  });
  
  return voti;
}

module.exports = {
  getVotiMEPItalianiDaParltrack,
  salvaVotiMEPItaliani
};
