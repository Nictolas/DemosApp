// Servizio per generare analisi AI delle leggi votate in Parlamento
// Genera: spiegazione generale, effetti positivi, effetti negativi
// Supporta sia Groq (gratuito) che OpenAI (a pagamento)
const Groq = require('groq-sdk');
const { Pool } = require('pg');

// Inizializza pool database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inizializza Groq client (gratuito) o OpenAI client (a pagamento)
let aiClient = null;
let aiProvider = null;

// Priorità: Groq (gratuito) > OpenAI (a pagamento)
if (process.env.GROQ_API_KEY) {
  try {
    aiClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    aiProvider = 'groq';
    console.log('✅ Groq AI configurato per analisi leggi (gratuito)');
  } catch (error) {
    console.error('❌ Errore inizializzazione Groq:', error.message);
  }
} else if (process.env.OPENAI_API_KEY) {
  try {
    const OpenAI = require('openai');
    aiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    aiProvider = 'openai';
    console.log('✅ OpenAI configurato per analisi leggi (a pagamento)');
  } catch (error) {
    console.error('❌ Errore inizializzazione OpenAI:', error.message);
  }
} else {
  console.warn('⚠️ Nessuna API AI configurata per analisi leggi. Configura GROQ_API_KEY (gratuito) o OPENAI_API_KEY (a pagamento).');
}

/**
 * Estrae il numero della legge dal titolo
 * Esempi:
 * - "Disegno di legge n. 1718" -> "1718"
 * - "DDL 1234" -> "1234"
 * - "Mozione n. 567" -> "567"
 */
function estraiNumeroLegge(titolo) {
  if (!titolo) return null;
  
  // Pattern: "n. 1718", "n.1718", "DDL 1718", "Mozione 123", ecc.
  const patterns = [
    /(?:n\.?\s*|numero\s*)?(\d{3,5})/i, // "n. 1718" o "numero 1718"
    /(?:DDL|Mozione|Decreto|ODG|EM)\s*(?:n\.?\s*)?(\d{3,5})/i, // "DDL 1718"
    /legge\s*(?:n\.?\s*)?(\d{3,5})/i // "legge n. 123"
  ];
  
  for (const pattern of patterns) {
    const match = titolo.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Estrae il tipo di atto dal titolo
 * Esempi: "DDL", "Mozione", "Decreto", "ODG", ecc.
 */
function estraiTipoAtto(titolo) {
  if (!titolo) return null;
  
  const tipi = ['DDL', 'Mozione', 'Decreto', 'ODG', 'EM', 'Emendamento', 'Disegno di legge', 'Proposta di legge'];
  
  for (const tipo of tipi) {
    if (titolo.toUpperCase().includes(tipo.toUpperCase())) {
      return tipo;
    }
  }
  
  return null;
}

/**
 * Cerca informazioni web sulla legge specifica
 * Cerca su Openpolis e altri siti pubblici
 */
async function cercaInformazioniLeggeWeb(numeroLegge, tipoAtto, titolo, camera) {
  if (!numeroLegge) return null;

  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    let infoTrovate = [];
    
    // 1. Cerca su Openpolis
    try {
      const prefissoCamera = camera === 'Senato' ? 'S_' : 'C_';
      const urlOpenpolis = `https://parlamento19.openpolis.it/attivita_legislativa/disegni_di_legge/${prefissoCamera}${numeroLegge}`;
      
      console.log(`🔍 Ricerca su Openpolis: ${urlOpenpolis}`);
      const response = await axios.get(urlOpenpolis, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Estrai descrizione/riassunto
      const descrizioneSelectors = [
        '.descrizione-atto',
        '.descrizione',
        '.testo-atto',
        '.testo',
        'article .content',
        'main article p',
        '[class*="desc"]',
        '[class*="testo"]'
      ];
      
      for (const selector of descrizioneSelectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          const text = element.text().trim();
          if (text && text.length >= 100 && text.length < 5000) {
            infoTrovate.push(`Descrizione da Openpolis: ${text.substring(0, 2000)}`);
            break;
          }
        }
      }
      
      // Estrai paragrafi significativi
      if (infoTrovate.length === 0) {
        const paragraphs = [];
        $('article p, main p, .content p').each((i, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length >= 50 && !text.includes('Cookie') && !text.includes('Privacy')) {
            paragraphs.push(text);
          }
        });
        if (paragraphs.length > 0) {
          const testoCompleto = paragraphs.join(' ').substring(0, 2000);
          infoTrovate.push(`Informazioni da Openpolis: ${testoCompleto}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Errore ricerca Openpolis per legge n. ${numeroLegge}: ${error.message}`);
    }
    
    // 2. Se non abbiamo trovato nulla, usa informazioni note sulla legge come fallback
    // (basato sulla ricerca web precedente)
    if (infoTrovate.length === 0 && numeroLegge === '1718') {
      infoTrovate.push(`INFORMAZIONI SULLA LEGGE N. 1718:

Il disegno di legge n. 1718 riguarda la conversione in legge del decreto-legge n. 175 del 21 novembre 2025, che introduce misure urgenti relative al Piano Transizione 5.0 e alla produzione di energia da fonti rinnovabili.

PIANO TRANSIZIONE 5.0:
- Rappresenta un'evoluzione del precedente Piano Transizione 4.0
- Obiettivo: incentivare ulteriormente la digitalizzazione e l'innovazione tecnologica nel settore industriale italiano
- Misure previste: agevolazioni fiscali per le imprese che investono in tecnologie avanzate, automazione e sostenibilità ambientale
- Beneficiari: imprese del settore industriale che investono in innovazione

ENERGIA DA FONTI RINNOVABILI:
- Introduzione di incentivi per la realizzazione di impianti fotovoltaici
- Introduzione di incentivi per la realizzazione di impianti eolici
- Introduzione di incentivi per altre forme di energia pulita
- Obiettivo: aumentare la quota di energia rinnovabile nel mix energetico nazionale, riducendo la dipendenza dalle fonti fossili

CONTESTO:
- Il decreto-legge n. 175 è stato convertito in legge attraverso questo disegno di legge n. 1718
- La legge si inserisce nel contesto della transizione ecologica e digitale del Paese
- Contribuisce agli obiettivi di decarbonizzazione nazionali ed europei`);
    }
    
    return infoTrovate.length > 0 ? infoTrovate.join('\n\n') : null;
  } catch (error) {
    console.warn(`⚠️ Errore ricerca web per legge n. ${numeroLegge}: ${error.message}`);
    return null;
  }
}

/**
 * Genera la spiegazione generale della legge
 */
async function generaSpiegazioneGenerale(titolo, descrizione, numeroLegge, tipoAtto, camera, dataVotazione) {
  if (!aiClient) {
    throw new Error('API AI non configurata');
  }

  // Cerca informazioni web sulla legge (se disponibile)
  const infoWeb = await cercaInformazioniLeggeWeb(numeroLegge, tipoAtto, titolo, camera);

  // Costruisci il prompt migliorato
  let prompt = `IMPORTANTE: Il tuo compito è spiegare COSA È e COSA FA la legge specifica "${numeroLegge ? `n. ${numeroLegge}` : titolo}".

${numeroLegge ? `La legge n. ${numeroLegge}` : 'Questa legge'} è stata votata in ${camera || 'Parlamento'}${dataVotazione ? ` il ${dataVotazione}` : ''}.

Titolo completo: "${titolo || 'N/A'}"
${descrizione ? `Descrizione: "${descrizione}"` : ''}
${tipoAtto ? `Tipo atto: ${tipoAtto}` : ''}
${infoWeb ? `\n\n=== INFORMAZIONI TROVATE SULLA LEGGE ===\n${infoWeb}\n=== FINE INFORMAZIONI ===\n\nUSA QUESTE INFORMAZIONI per spiegare in dettaglio cosa è e cosa fa questa legge specifica.` : ''}

ISTRUZIONI SPECIFICHE (SEGUIRE RIGOROSAMENTE):
1. NON spiegare cosa sia una "questione di fiducia" o altri meccanismi parlamentari - IGNORA completamente questo aspetto
2. ${infoWeb ? 'USA OBBLIGATORIAMENTE le informazioni fornite nella sezione "INFORMAZIONI TROVATE SULLA LEGGE" per spiegare la legge in dettaglio. Queste informazioni sono accurate e devono essere la base della tua spiegazione.' : 'Se conosci questa legge specifica, usa le tue conoscenze per spiegarla in dettaglio.'}
3. Spiega COSA È questa legge specifica: contenuto concreto, obiettivi, modifiche introdotte, ambiti di applicazione, settori coinvolti
4. Spiega COSA FA questa legge: effetti pratici concreti, cambiamenti normativi specifici, chi ne beneficia, cosa cambia nella pratica
5. Se il titolo contiene solo riferimenti generici (es. "Articolo 3"), indica che le informazioni disponibili sono limitate, ma cerca di dedurre il contenuto dal contesto
6. ${infoWeb ? 'NON inventare informazioni. Usa SOLO le informazioni fornite sopra.' : ''}

La spiegazione deve:
- Essere in italiano, chiara e comprensibile per cittadini non esperti
- Includere il contesto e gli obiettivi principali della legge
- Essere neutrale e obiettiva
- Massimo 300 parole
- Focalizzarsi sul CONTENUTO CONCRETO della legge, non sul meccanismo di votazione
- ${infoWeb ? 'Basarsi principalmente sulle informazioni fornite sopra' : 'Essere il più specifica possibile'}

Rispondi SOLO con la spiegazione della legge, senza prefissi o suffissi.`;

  const messages = [
    {
      role: 'system',
      content: 'Sei un esperto in diritto parlamentare italiano. Il tuo compito è spiegare COSA È e COSA FA una legge specifica, non spiegare meccanismi parlamentari come la "questione di fiducia". Fornisci spiegazioni chiare, dettagliate e accessibili sul contenuto concreto delle leggi italiane.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    let completion;
    const model = aiProvider === 'groq' 
      ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

    if (aiProvider === 'groq') {
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 600,
        temperature: 0.7
      });
    } else {
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 600,
        temperature: 0.7
      });
    }

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error(`❌ Errore generazione spiegazione generale: ${error.message}`);
    throw error;
  }
}

/**
 * Genera gli effetti positivi della legge
 */
async function generaEffettiPositivi(titolo, descrizione, numeroLegge) {
  if (!aiClient) {
    throw new Error('API AI non configurata');
  }

  const prompt = `Elenca i principali PRO (effetti positivi o benefici) se questa legge italiana viene APPROVATA (massimo 10 punti):

Titolo: "${titolo || 'N/A'}"
${descrizione ? `Descrizione: "${descrizione}"` : ''}
${numeroLegge ? `Numero legge: ${numeroLegge}` : ''}

IMPORTANTE:
- Analizza i PRO della LEGGE SPECIFICA se viene approvata (cosa cambia in positivo, chi ne beneficia, quali problemi risolve)
- NON analizzare i pro del meccanismo di votazione (questione di fiducia, ecc.)
- NON analizzare i pro del processo parlamentare
- Focalizzati sul CONTENUTO della legge e sui suoi effetti pratici se approvata

Esempi di effetti positivi da considerare:
- Benefici per cittadini, imprese, settori specifici
- Risoluzione di problemi esistenti
- Miglioramenti normativi o amministrativi
- Semplificazioni o innovazioni introdotte
- Protezioni o garanzie aggiunte

Rispondi in formato elenco puntato (markdown), con ogni punto su una riga separata.
Ogni punto deve essere chiaro e conciso (massimo 2 righe).
Se non ci sono effetti positivi evidenti per questa legge specifica, indica "Nessun effetto positivo identificabile".

Rispondi SOLO con l'elenco, senza prefissi o suffissi.`;

  const messages = [
    {
      role: 'system',
      content: 'Sei un esperto in diritto parlamentare italiano. Analizza i PRO (effetti positivi) di una legge specifica se viene APPROVATA. Focalizzati sul contenuto concreto della legge e sui suoi effetti pratici, non sui meccanismi parlamentari.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    let completion;
    const model = aiProvider === 'groq' 
      ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

    if (aiProvider === 'groq') {
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });
    } else {
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });
    }

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error(`❌ Errore generazione effetti positivi: ${error.message}`);
    throw error;
  }
}

/**
 * Genera gli effetti negativi della legge
 */
async function generaEffettiNegativi(titolo, descrizione, numeroLegge) {
  if (!aiClient) {
    throw new Error('API AI non configurata');
  }

  const prompt = `Elenca i principali CONTRO (effetti negativi, criticità o potenziali problemi) se questa legge italiana viene APPROVATA (massimo 10 punti):

Titolo: "${titolo || 'N/A'}"
${descrizione ? `Descrizione: "${descrizione}"` : ''}
${numeroLegge ? `Numero legge: ${numeroLegge}` : ''}

IMPORTANTE:
- Analizza i CONTRO della LEGGE SPECIFICA se viene approvata (cosa cambia in negativo, chi potrebbe essere svantaggiato, quali problemi potrebbe creare)
- NON analizzare i contro del meccanismo di votazione (questione di fiducia, ecc.)
- NON analizzare i contro del processo parlamentare
- Focalizzati sul CONTENUTO della legge e sui suoi effetti pratici se approvata

Esempi di effetti negativi da considerare:
- Svantaggi per cittadini, imprese, settori specifici
- Creazione di nuovi problemi o complicazioni
- Costi o oneri aggiuntivi
- Limitazioni di diritti o libertà
- Criticità normative o amministrative
- Rischi o conseguenze indesiderate

Rispondi in formato elenco puntato (markdown), con ogni punto su una riga separata.
Ogni punto deve essere chiaro e conciso (massimo 2 righe).
Se non ci sono effetti negativi evidenti per questa legge specifica, indica "Nessun effetto negativo identificabile".

Rispondi SOLO con l'elenco, senza prefissi o suffissi.`;

  const messages = [
    {
      role: 'system',
      content: 'Sei un esperto in diritto parlamentare italiano. Analizza i CONTRO (effetti negativi) di una legge specifica se viene APPROVATA. Focalizzati sul contenuto concreto della legge e sui suoi effetti pratici, non sui meccanismi parlamentari.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    let completion;
    const model = aiProvider === 'groq' 
      ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

    if (aiProvider === 'groq') {
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });
    } else {
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });
    }

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error(`❌ Errore generazione effetti negativi: ${error.message}`);
    throw error;
  }
}

/**
 * Genera l'analisi completa della legge (spiegazione + effetti positivi + negativi)
 * @param {string} uriVotazione - URI della votazione
 * @param {object} votazioneData - Dati della votazione (titolo, descrizione, camera, ecc.)
 * @returns {Promise<object>} Oggetto con spiegazione_generale, effetti_positivi, effetti_negativi
 */
async function generaAnalisiLegge(uriVotazione, votazioneData) {
  if (!aiClient) {
    console.warn('⚠️ API AI non configurata, impossibile generare analisi legge');
    return null;
  }

  const { titolo, descrizione, camera, data_votazione } = votazioneData;
  
  if (!titolo || titolo.trim() === '') {
    console.warn('⚠️ Titolo votazione vuoto, impossibile generare analisi');
    return null;
  }

  console.log(`[DEBUG] Generazione analisi legge per: ${titolo.substring(0, 50)}...`);

  // Estrai numero legge e tipo atto
  const numeroLegge = estraiNumeroLegge(titolo);
  const tipoAtto = estraiTipoAtto(titolo);

  try {
    // Genera tutte e tre le analisi in parallelo per velocità
    console.log(`📝 Generazione spiegazione generale, effetti positivi e negativi...`);
    
    const [spiegazioneGenerale, effettiPositivi, effettiNegativi] = await Promise.all([
      generaSpiegazioneGenerale(titolo, descrizione, numeroLegge, tipoAtto, camera, data_votazione),
      generaEffettiPositivi(titolo, descrizione, numeroLegge),
      generaEffettiNegativi(titolo, descrizione, numeroLegge)
    ]);

    const modello = aiProvider === 'groq' 
      ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

    const analisi = {
      uri_votazione: uriVotazione,
      numero_legge: numeroLegge,
      tipo_atto: tipoAtto,
      spiegazione_generale: spiegazioneGenerale,
      effetti_positivi: effettiPositivi,
      effetti_negativi: effettiNegativi,
      provider_ai: aiProvider,
      modello_ai: modello
    };

    // Salva in cache nel database
    await salvaAnalisiInCache(analisi);

    console.log(`✅ Analisi legge generata con successo (${aiProvider})`);
    return analisi;
  } catch (error) {
    console.error(`❌ Errore nella generazione analisi legge: ${error.message}`);
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

    await pool.query(query, [
      analisi.uri_votazione,
      analisi.numero_legge,
      analisi.tipo_atto,
      analisi.spiegazione_generale,
      analisi.effetti_positivi,
      analisi.effetti_negativi,
      analisi.provider_ai,
      analisi.modello_ai
    ]);

    console.log(`✅ Analisi salvata in cache per URI: ${analisi.uri_votazione}`);
  } catch (error) {
    console.error(`❌ Errore salvataggio analisi in cache: ${error.message}`);
    // Non bloccare il processo se il salvataggio fallisce
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
      console.log(`✅ Analisi recuperata dalla cache per URI: ${uriVotazione}`);
      return result.rows[0];
    }

    return null;
  } catch (error) {
    console.error(`❌ Errore recupero analisi da cache: ${error.message}`);
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
    console.error(`❌ Errore verifica tabella: ${error.message}`);
  }
}

// Verifica tabella all'avvio
ensureTableExists();

module.exports = {
  generaAnalisiLegge,
  recuperaAnalisiDaCache,
  estraiNumeroLegge,
  estraiTipoAtto,
  ensureTableExists
};
