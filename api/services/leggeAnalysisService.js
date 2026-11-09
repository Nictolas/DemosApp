// Servizio per generare analisi AI delle leggi votate in Parlamento
// Genera: spiegazione generale, effetti positivi, effetti negativi
// Vincolo DEMOS: nessun fallback a provider a pagamento per le votazioni.
const Groq = require('groq-sdk');
const { resolveFreeGroqModel, isGroqConfigured } = require('./parliamentFreeAiPolicy');
const { buildGroundedAnalysisMessages, parseGroundedAnalysisResponse } = require('./parliamentGroundedAnalysis');
const { requestFreeGroq, classifyFreeGroqError } = require('./parliamentFreeGroqBudget');
const { createSingleflight } = require('./parliamentAiSingleflight');
const { estraiNumeroLegge, canSearchActTitle, canUseBillTextAsVoteEvidence, estraiTipoAtto } = require('./parliamentActIdentifier');
const singleflightAnalisi = createSingleflight();
const { getPool } = require('../config/database');

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Solo modelli con quota gratuita: nessuna istanziazione di client OpenAI.
let aiClient = null;
let aiProvider = null;
let groqModel = null;

if (isGroqConfigured()) {
  try {
    groqModel = resolveFreeGroqModel(process.env.GROQ_MODEL);
    aiClient = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
    aiProvider = 'groq';
    console.log('Groq AI parlamentare pronto (modello Free allowlisted)');
  } catch (_error) {
    // Fail closed: a retired / non-allowlisted model must never trigger paid fallback.
    groqModel = null;
    aiClient = null;
    aiProvider = null;
    console.warn('Groq AI parlamentare disabilitato: modello non consentito nel piano Free');
  }
} else {
  console.warn('Analisi AI parlamentare non disponibile: chiave Groq Free mancante; nessun fallback a pagamento');
}

/**
 * Estrae dettagli numerici (percentuali, importi, date) dal testo
 */
function estraiDettagliNumerici(testo) {
  const dettagli = [];
  
  // Pattern per percentuali (es: 50%, 30 per cento, 25%)
  const percentuali = testo.match(/\d+[\.,]?\d*\s*%|(\d+[\.,]?\d*)\s*(per\s*cento|percento)/gi);
  if (percentuali) {
    dettagli.push(`Percentuali trovate: ${percentuali.join(', ')}`);
  }
  
  // Pattern per importi (es: €1000, 5000 euro, 1.000.000 €)
  const importi = testo.match(/€\s*\d+[\.,]?\d*[\.,]?\d*|\d+[\.,]?\d*[\.,]?\d*\s*(euro|€|miliardi|milioni)/gi);
  if (importi) {
    dettagli.push(`Importi trovati: ${importi.join(', ')}`);
  }
  
  // Pattern per date (es: 31/12/2025, 2025-12-31)
  const date = testo.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g);
  if (date) {
    dettagli.push(`Date trovate: ${date.join(', ')}`);
  }
  
  // Pattern per potenze/limiti (es: 50 kW, 100 MW)
  const potenze = testo.match(/\d+[\.,]?\d*\s*(kW|MW|GW|kWh|MWh)/gi);
  if (potenze) {
    dettagli.push(`Potenze/Energie trovate: ${potenze.join(', ')}`);
  }
  
  return dettagli.length > 0 ? dettagli.join('\n') : null;
}

/**
 * Estrae articoli completi con tutto il contenuto associato
 */
function estraiArticoliCompleti($) {
  const articoli = [];
  const articoliMap = new Map();
  
  // Prima passata: trova tutti gli articoli
  $('p, div, span, article, section').each((i, elem) => {
    const text = $(elem).text().trim();
    const match = text.match(/^(Art\.?\s*\d+|Articolo\s+\d+)[\.\)\s]/i);
    
    if (match) {
      const numArt = match[1].replace(/[^\d]/g, '');
      if (!articoliMap.has(numArt)) {
        articoliMap.set(numArt, []);
      }
      
      // Estrai tutto il contenuto dell'elemento e dei suoi figli
      let contenutoCompleto = '';
      $(elem).find('*').each((j, child) => {
        const testoFiglio = $(child).text().trim();
        if (testoFiglio && testoFiglio.length > 10) {
          contenutoCompleto += testoFiglio + ' ';
        }
      });
      
      // Se non ci sono figli, usa il testo diretto
      if (!contenutoCompleto) {
        contenutoCompleto = text;
      }
      
      articoliMap.get(numArt).push(contenutoCompleto);
    }
  });
  
  // Seconda passata: cerca contenuto associato agli articoli (paragrafi successivi)
  let ultimoArticolo = null;
  $('p, div, li').each((i, elem) => {
    const text = $(elem).text().trim();
    const match = text.match(/^(Art\.?\s*\d+|Articolo\s+\d+)[\.\)\s]/i);
    
    if (match) {
      ultimoArticolo = match[1].replace(/[^\d]/g, '');
    } else if (ultimoArticolo && text.length > 30 && 
               !text.includes('Cookie') && 
               !text.includes('Privacy') &&
               !text.match(/^Menu|^Home|^Contatti/i)) {
      // Aggiungi questo contenuto all'ultimo articolo trovato
      if (articoliMap.has(ultimoArticolo)) {
        articoliMap.get(ultimoArticolo).push(text);
      }
    }
  });
  
  // Combina tutto il contenuto per ogni articolo
  articoliMap.forEach((contenuti, numArt) => {
    const contenutoCompleto = contenuti.join(' ').substring(0, 3000); // Limite più alto per articoli completi
    if (contenutoCompleto.length > 100) {
      articoli.push(`Art. ${numArt}: ${contenutoCompleto}`);
    }
  });
  
  return articoli;
}

/**
 * Estrae articoli e sezioni rilevanti dal testo HTML
 */
function estraiArticoliETesto($) {
  const articoli = [];
  const testo = [];
  const dettagliNumerici = [];
  
  // Estrai articoli completi
  const articoliCompleti = estraiArticoliCompleti($);
  articoli.push(...articoliCompleti);
  
  // Estrai paragrafi significativi
  $('p, li, td').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text.length >= 50 && 
        !text.includes('Cookie') && 
        !text.includes('Privacy') &&
        !text.includes('Accetta') &&
        !text.match(/^Menu|^Home|^Contatti/i)) {
      testo.push(text);
      
      // Estrai dettagli numerici da ogni paragrafo
      const dettagli = estraiDettagliNumerici(text);
      if (dettagli) {
        dettagliNumerici.push(dettagli);
      }
    }
  });
  
  // Estrai anche da tabelle (spesso contengono dati strutturati)
  $('table tr').each((i, row) => {
    const celle = [];
    $(row).find('td, th').each((j, cell) => {
      const testo = $(cell).text().trim();
      if (testo && testo.length > 5) {
        celle.push(testo);
      }
    });
    if (celle.length > 0) {
      const rigaTabella = celle.join(' | ');
      testo.push(rigaTabella);
      
      const dettagli = estraiDettagliNumerici(rigaTabella);
      if (dettagli) {
        dettagliNumerici.push(dettagli);
      }
    }
  });
  
  // Estrai anche da elementi con classi comuni per contenuti normativi
  $('[class*="articolo"], [class*="testo"], [class*="contenuto"], [id*="articolo"], [id*="testo"]').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text.length > 100 && 
        !text.includes('Cookie') && 
        !text.includes('Privacy') &&
        !text.match(/^Menu|^Home|^Contatti|^Navigazione/i)) {
      testo.push(text);
      
      // Cerca articoli anche in questi elementi
      if (text.match(/Art\.?\s*\d+/i) || text.match(/Articolo\s+\d+/i)) {
        const match = text.match(/(Art\.?\s*\d+[^\n]*(?:\n[^\n]*){0,10})/i);
        if (match) {
          articoli.push(match[0].substring(0, 2000));
        }
      }
      
      const dettagli = estraiDettagliNumerici(text);
      if (dettagli) {
        dettagliNumerici.push(dettagli);
      }
    }
  });
  
  // Filtra testo troppo corto o non significativo
  const testoFiltrato = testo.filter(t => {
    // Rimuovi testo che sembra essere solo navigazione o menu
    if (t.length < 30) return false;
    if (t.match(/^(Menu|Home|Contatti|Navigazione|Cookie|Privacy|Accetta|Rifiuta)/i)) return false;
    if (t.split(' ').length < 5) return false; // Almeno 5 parole
    return true;
  });
  
  // Combina tutti i dettagli numerici trovati
  const tuttiDettagliNumerici = dettagliNumerici.length > 0 
    ? dettagliNumerici.join('\n---\n')
    : null;
  
  const risultato = {
    articoli: articoli.slice(0, 30), // Aumentato a 30 articoli
    testo: testoFiltrato.slice(0, 100).join(' '), // Aumentato a 100 paragrafi
    dettagliNumerici: tuttiDettagliNumerici
  };
  
  // Log per debug
  if (articoli.length > 0) {
    console.log(`   📜 Articoli estratti: ${articoli.length}`);
  }
  if (tuttiDettagliNumerici) {
    console.log(`   🔢 Dettagli numerici estratti: ${dettagliNumerici.length} sezioni`);
  }
  if (testoFiltrato.length > 0) {
    console.log(`   📄 Paragrafi significativi: ${testoFiltrato.length}`);
  }
  
  return risultato;
}

/**
 * Cerca informazioni web sulla legge specifica
 * Cerca su Openpolis, Senato.it, Normattiva.it
 */
async function cercaInformazioniLeggeWeb(numeroLegge, tipoAtto, titolo, camera) {
  if (!canUseBillTextAsVoteEvidence(titolo)) {
    // A DDL's general text does not establish what a separately numbered
    // amendment, confidence motion, article vote or procedural item proposed.
    // Without exact voted-item evidence, show only the official vote result.
    return null;
  }
  if (!canSearchActTitle(numeroLegge, titolo, camera)) {
    // Anche il Parlamento europeo non deve essere ricercato per numero sul
    // catalogo dei DDL italiani: le due numerazioni sono indipendenti.
    return null;
  }

  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    let infoTrovate = [];
    let testoCompleto = '';
    
    // 1. Cerca su Senato.it (per DDL del Senato)
    if (camera === 'Senato') {
      try {
        // URL pattern: https://www.senato.it/leg/19/BGT/Schede/Ddliter/testi/[numero]/[numero].htm
        const urlSenato = `https://www.senato.it/leg/19/BGT/Schede/Ddliter/testi/${numeroLegge}/${numeroLegge}.htm`;
        
        console.log('Consultazione fonte ufficiale Senato.it avviata');
        const response = await axios.get(urlSenato, {
          headers: {
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
          const $ = cheerio.load(response.data);
          const { articoli, testo, dettagliNumerici } = estraiArticoliETesto($);
          
          if (articoli.length > 0) {
            infoTrovate.push(`ARTICOLI DEL DDL N. ${numeroLegge} (da Senato.it):\n${articoli.join('\n\n---\n\n')}`);
          }
          
          if (dettagliNumerici) {
            infoTrovate.push(`DETTAGLI NUMERICI (da Senato.it):\n${dettagliNumerici}`);
          }
          
          if (testo.length > 500) {
            testoCompleto += `\n\nTESTO COMPLETO (da Senato.it):\n${testo.substring(0, 8000)}`;
          }
        }
      } catch (error) {
        console.warn('Consultazione fonte ufficiale Senato.it non riuscita');
      }
    }
    
    // Non associare automaticamente un numero DDL a un decreto Normattiva o
    // a una Gazzetta Ufficiale: il legame richiede un identificativo ufficiale
    // verificato, non può essere dedotto dal solo titolo.

    // Non usare automaticamente pagine di terze parti come se fossero il
    // testo dell'atto. Per la Camera, se manca una descrizione documentale
    // verificata nei dati già acquisiti, preferiamo non generare un'analisi
    // piuttosto che inferire il contenuto da un sito generico.

    // Combina tutte le informazioni trovate
    const risultato = infoTrovate.length > 0 
      ? infoTrovate.join('\n\n---\n\n') + testoCompleto
      : null;
    
    // Log dettagliato per debug
    console.log(`📊 Riepilogo ricerca web per legge n. ${numeroLegge}:`);
    console.log(`   - Fonti consultate: ${infoTrovate.length}`);
    console.log(`   - Articoli trovati: ${infoTrovate.filter(i => i.includes('ARTICOLI')).length}`);
    console.log(`   - Dettagli numerici trovati: ${infoTrovate.filter(i => i.includes('DETTAGLI NUMERICI')).length}`);
    console.log(`   - Testo completo: ${testoCompleto.length > 0 ? `${(testoCompleto.length / 1000).toFixed(1)} KB` : 'Nessuno'}`);
    console.log(`   - Risultato finale: ${risultato ? `${(risultato.length / 1000).toFixed(1)} KB` : 'Nessuno'}`);
    
    return risultato;
  } catch (error) {
    console.warn('Recupero documentazione ufficiale non riuscito');
    return null;
  }
}

/**
 * Genera l'analisi completa della legge (spiegazione + effetti positivi + negativi)
 * @param {string} uriVotazione - URI della votazione
 * @param {object} votazioneData - Dati della votazione (titolo, descrizione, camera, ecc.)
 * @returns {Promise<object>} Oggetto con spiegazione_generale, effetti_positivi, effetti_negativi
 */
async function generaAnalisiLegge(uriVotazione, votazioneData) {
  if (typeof uriVotazione !== 'string' || !uriVotazione.trim() ||
      !votazioneData || typeof votazioneData !== 'object' || Array.isArray(votazioneData)) {
    console.warn('Analisi parlamentare non generata: input votazione non valido');
    return null;
  }
  return singleflightAnalisi(uriVotazione, () => generaAnalisiLeggeUnaVolta(uriVotazione, votazioneData));
}

async function generaAnalisiLeggeUnaVolta(uriVotazione, votazioneData) {
  if (!aiClient) {
    console.warn('⚠️ API AI non configurata, impossibile generare analisi legge');
    return null;
  }

  const { titolo, descrizione, camera, data_votazione } = votazioneData;
  
  if (!titolo || titolo.trim() === '') {
    console.warn('⚠️ Titolo votazione vuoto, impossibile generare analisi');
    return null;
  }

  // Una sola chiamata AI per votazione; mai spiegare un mero titolo.
  const numeroLegge = estraiNumeroLegge(titolo);
  const tipoAtto = estraiTipoAtto(titolo);
  try {
    // Usa prima la descrizione presente. Solo quando insufficiente cerca il testo.
    const documento = typeof descrizione === 'string' && descrizione.trim().length >= 160
      ? ''
      : await cercaInformazioniLeggeWeb(numeroLegge, tipoAtto, titolo, camera);

    const messages = buildGroundedAnalysisMessages({
      titolo,
      descrizione,
      infoFonte: documento,
      camera,
      tipoAtto,
      dataVotazione: data_votazione
    });
    if (!messages) {
      console.warn('Analisi AI parlamentare non eseguita: manca testo documentale sufficiente');
      return null;
    }

    const completion = await requestFreeGroq(aiClient, {
      model: groqModel,
      messages,
      max_completion_tokens: 850,
      temperature: 0,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' }
    });
    if (!completion) {
      console.warn('Analisi parlamentare rimandata: quota Groq Free o limite 429');
      return null;
    }
    // A syntactically valid JSON object can still come from a completion
    // stopped by its token limit. Only a normally finished response is safe to cache.
    const choice = completion.choices?.[0];
    if (choice?.finish_reason !== 'stop') {
      console.warn('Analisi parlamentare scartata: completamento non terminato normalmente');
      return null;
    }
    const parsed = parseGroundedAnalysisResponse(choice.message?.content);
    if (!parsed) {
      console.warn('Analisi AI non pubblicata: risposta non conforme allo schema JSON');
      return null;
    }

    const modello = groqModel;

    const analisi = {
      uri_votazione: uriVotazione,
      numero_legge: numeroLegge,
      tipo_atto: tipoAtto,
      spiegazione_generale: parsed.spiegazione_generale,
      effetti_positivi: parsed.effetti_positivi,
      effetti_negativi: parsed.effetti_negativi,
      provider_ai: aiProvider,
      modello_ai: modello
    };

    // An analysis is only ready for delivery after its database write succeeds.
    // Do not report a generated-but-lost response as a persisted explanation.
    if (!(await salvaAnalisiInCache(analisi))) return null;

    console.log('Analisi parlamentare generata e salvata');
    return analisi;
  } catch (error) {
    console.error('Analisi AI parlamentare non disponibile:', classifyFreeGroqError(error));
    throw error;
  }
}

/**
 * Salva l'analisi nella tabella cache
 */
async function salvaAnalisiInCache(analisi) {
  try {
    const query = `
      INSERT INTO parlamento_analisi_legge (
        uri_votazione, numero_legge, tipo_atto,
        spiegazione_generale, effetti_positivi, effetti_negativi,
        provider_ai, modello_ai, data_generazione, data_aggiornamento
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (uri_votazione) DO UPDATE SET
        numero_legge = EXCLUDED.numero_legge,
        tipo_atto = EXCLUDED.tipo_atto,
        spiegazione_generale = EXCLUDED.spiegazione_generale,
        effetti_positivi = EXCLUDED.effetti_positivi,
        effetti_negativi = EXCLUDED.effetti_negativi,
        provider_ai = EXCLUDED.provider_ai,
        modello_ai = EXCLUDED.modello_ai,
        data_aggiornamento = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    const result = await pool.query(query, [
      analisi.uri_votazione,
      analisi.numero_legge,
      analisi.tipo_atto,
      analisi.spiegazione_generale,
      analisi.effetti_positivi,
      analisi.effetti_negativi,
      analisi.provider_ai,
      analisi.modello_ai
    ]);
    if (result?.rowCount !== 1) {
      console.warn('Salvataggio cache analisi parlamentare senza riga confermata');
      return false;
    }

    console.log('Analisi parlamentare salvata in cache');
    return true;
  } catch (_) {
    console.error('Salvataggio cache analisi parlamentare non riuscito');
    return false;
  }
}

/**
 * Recupera l'analisi dalla cache se disponibile
 */
async function recuperaAnalisiDaCache(uriVotazione) {
  try {
    const query = `
      SELECT 
        id, uri_votazione, numero_legge, tipo_atto,
        spiegazione_generale, effetti_positivi, effetti_negativi,
        provider_ai, modello_ai, data_generazione, data_aggiornamento
      FROM parlamento_analisi_legge
      WHERE uri_votazione = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [uriVotazione]);
    
    if (result.rows.length > 0) {
      console.log('Analisi parlamentare recuperata dalla cache');
      return result.rows[0];
    }

    return null;
  } catch (error) {
    console.error('Lettura cache analisi parlamentare non riuscita');
    return null;
  }
}

/**
 * Assicura che la tabella esista
 */
async function ensureTableExists() {
  try {
    // Verifica se la tabella esiste
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'parlamento_analisi_legge'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.warn('⚠️ Tabella parlamento_analisi_legge non esiste. Esegui lo script SQL: create-parlamento-analisi-legge-table.sql');
    }
  } catch (error) {
    console.error('Verifica schema analisi parlamentare non riuscita');
  }
}

// Verifica tabella all'avvio
ensureTableExists();

module.exports = {
  generaAnalisiLegge,
  recuperaAnalisiDaCache,
  estraiNumeroLegge,
  estraiTipoAtto,
  ensureTableExists,
  cercaInformazioniLeggeWeb // Esportata per test
};
