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
 * Genera la spiegazione generale della legge
 */
async function generaSpiegazioneGenerale(titolo, descrizione, numeroLegge, tipoAtto, camera, dataVotazione) {
  if (!aiClient) {
    throw new Error('API AI non configurata');
  }

  const prompt = `Spiega in modo dettagliato e comprensibile (massimo 300 parole) questa legge italiana:

Titolo: "${titolo || 'N/A'}"
${descrizione ? `Descrizione: "${descrizione}"` : ''}
${numeroLegge ? `Numero legge: ${numeroLegge}` : ''}
${tipoAtto ? `Tipo atto: ${tipoAtto}` : ''}
Camera: ${camera || 'N/A'}
${dataVotazione ? `Data votazione: ${dataVotazione}` : ''}

La spiegazione deve:
- Essere in italiano
- Essere comprensibile per cittadini non esperti
- Spiegare cosa fa la legge in modo dettagliato
- Includere il contesto e gli obiettivi principali
- Essere neutrale e obiettiva
- Non superare le 300 parole

Rispondi SOLO con la spiegazione, senza prefissi o suffissi.`;

  const messages = [
    {
      role: 'system',
      content: 'Sei un esperto in diritto parlamentare italiano. Fornisci spiegazioni chiare, dettagliate e accessibili delle leggi italiane.'
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

  const prompt = `Elenca i principali effetti positivi o benefici di questa legge italiana (massimo 10 punti):

Titolo: "${titolo || 'N/A'}"
${descrizione ? `Descrizione: "${descrizione}"` : ''}
${numeroLegge ? `Numero legge: ${numeroLegge}` : ''}

Rispondi in formato elenco puntato (markdown), con ogni punto su una riga separata.
Ogni punto deve essere chiaro e conciso (massimo 2 righe).
Se non ci sono effetti positivi evidenti, indica "Nessun effetto positivo identificabile".

Rispondi SOLO con l'elenco, senza prefissi o suffissi.`;

  const messages = [
    {
      role: 'system',
      content: 'Sei un esperto in diritto parlamentare italiano. Analizza le leggi in modo obiettivo e neutrale.'
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

  const prompt = `Elenca i principali effetti negativi, criticità o potenziali problemi di questa legge italiana (massimo 10 punti):

Titolo: "${titolo || 'N/A'}"
${descrizione ? `Descrizione: "${descrizione}"` : ''}
${numeroLegge ? `Numero legge: ${numeroLegge}` : ''}

Rispondi in formato elenco puntato (markdown), con ogni punto su una riga separata.
Ogni punto deve essere chiaro e conciso (massimo 2 righe).
Se non ci sono effetti negativi evidenti, indica "Nessun effetto negativo identificabile".

Rispondi SOLO con l'elenco, senza prefissi o suffissi.`;

  const messages = [
    {
      role: 'system',
      content: 'Sei un esperto in diritto parlamentare italiano. Analizza le leggi in modo obiettivo e neutrale.'
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
