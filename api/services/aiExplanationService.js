// Servizio per generare spiegazioni AI delle votazioni
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
  aiClient = new Groq({
    apiKey: process.env.GROQ_API_KEY
  });
  aiProvider = 'groq';
  console.log('✅ Groq AI configurato (gratuito)');
} else if (process.env.OPENAI_API_KEY) {
  const OpenAI = require('openai');
  aiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  aiProvider = 'openai';
  console.log('✅ OpenAI configurato (a pagamento)');
} else {
  console.warn('⚠️ Nessuna API AI configurata. Configura GROQ_API_KEY (gratuito) o OPENAI_API_KEY (a pagamento).');
}

/**
 * Genera una spiegazione AI per una votazione
 * @param {string} votazione - Il titolo/descrizione della votazione
 * @param {string} descrizioneVotazione - La descrizione completa scrapata da Openpolis (opzionale)
 * @param {string} camera - "Camera" o "Senato"
 * @param {string} voto - "Favorevole", "Contrario", "Astenuto", "In missione"
 * @returns {Promise<string|null>} La spiegazione generata o null se errore
 */
async function generaSpiegazione(votazione, descrizioneVotazione, camera, voto) {
  if (!aiClient) {
    console.warn('⚠️ Nessuna API AI configurata, impossibile generare spiegazione');
    return null;
  }

  if (!votazione || votazione.trim() === '') {
    console.warn('⚠️ Votazione vuota, impossibile generare spiegazione');
    return null;
  }

  // Normalizza descrizioneVotazione (può essere undefined, null o stringa)
  const descrizione = descrizioneVotazione && typeof descrizioneVotazione === 'string' && descrizioneVotazione.trim() !== '' 
    ? descrizioneVotazione.trim() 
    : null;

  // Verifica limite giornaliero prima di generare (solo se non è Groq che è completamente gratuito)
  if (aiProvider !== 'groq') {
    const limiteCheck = await verificaLimiteGiornaliero();
    if (!limiteCheck.rispettato) {
      console.warn(`⚠️ Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite}`);
      throw new Error(`Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite} spiegazioni generate oggi`);
    }
  }

  try {
    // Costruisci il prompt con tutte le informazioni disponibili
    let prompt = `Spiega in modo chiaro e conciso (massimo 150 parole) questa votazione parlamentare italiana:

Titolo votazione: "${votazione}"`;

    // Aggiungi la descrizione se disponibile
    if (descrizione && descrizione.length > 0) {
      prompt += `\n\nDescrizione completa:\n"${descrizione}"`;
    }

    prompt += `\n\nCamera: ${camera}
Voto espresso: ${voto}

La spiegazione deve:
- Essere in italiano
- Essere comprensibile per cittadini non esperti
- Spiegare di cosa tratta la votazione in modo dettagliato e preciso
- Essere neutrale e obiettiva
- Basarsi principalmente sulla descrizione completa se disponibile
- Non superare le 150 parole

Rispondi SOLO con la spiegazione, senza prefissi o suffissi.`;

    const messages = [
      {
        role: 'system',
        content: 'Sei un assistente esperto in diritto parlamentare italiano. Fornisci spiegazioni chiare e accessibili delle votazioni parlamentari.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    let completion;

    if (aiProvider === 'groq') {
      // Groq API (gratuito)
      const model = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 300,
        temperature: 0.7
      });
    } else {
      // OpenAI API (a pagamento)
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      completion = await aiClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 300,
        temperature: 0.7
      });
    }

    const spiegazione = completion.choices[0]?.message?.content?.trim();
    
    if (spiegazione) {
      console.log(`✅ Spiegazione generata (${aiProvider}) per: ${votazione.substring(0, 50)}...`);
      return spiegazione;
    }

    return null;
  } catch (error) {
    console.error(`❌ Errore nella generazione spiegazione AI (${aiProvider}):`, error.message);
    // Non bloccare il processo se la generazione fallisce
    return null;
  }
}

/**
 * Salva o aggiorna la spiegazione per un politico nella tabella voti_camera
 * @param {string} politicoNome - Nome completo del politico
 * @param {string} spiegazione - La spiegazione da salvare
 * @returns {Promise<boolean>} True se salvato con successo
 */
async function salvaSpiegazione(politicoNome, spiegazione) {
  if (!spiegazione || spiegazione.trim() === '') {
    return false;
  }

  try {
    await pool.query(
      `UPDATE voti_camera 
       SET spiegazione = $1 
       WHERE politico_nome = $2`,
      [spiegazione.trim(), politicoNome]
    );
    return true;
  } catch (error) {
    console.error(`❌ Errore nel salvataggio spiegazione per ${politicoNome}:`, error.message);
    return false;
  }
}

/**
 * Genera e salva la spiegazione per una votazione
 * @param {string} politicoNome - Nome completo del politico
 * @param {string} votazione - Il titolo/descrizione della votazione
 * @param {string} descrizioneVotazione - La descrizione completa scrapata da Openpolis (opzionale)
 * @param {string} camera - "Camera" o "Senato"
 * @param {string} voto - "Favorevole", "Contrario", "Astenuto", "In missione"
 * @param {boolean} forceRegenerate - Forza la rigenerazione anche se esiste già (default: false)
 * @returns {Promise<string|null>} La spiegazione generata o null
 */
async function generaESalvaSpiegazione(politicoNome, votazione, descrizioneVotazione, camera, voto, forceRegenerate = false) {
  // Verifica se esiste già una spiegazione per questa votazione
  const existingResult = await pool.query(
    `SELECT spiegazione, descrizione_votazione FROM voti_camera WHERE politico_nome = $1 AND votazione = $2`,
    [politicoNome, votazione]
  );

  // Se esiste già una spiegazione per questa votazione e non è forzata la rigenerazione, non rigenerarla
  if (!forceRegenerate && existingResult.rows.length > 0 && existingResult.rows[0].spiegazione && existingResult.rows[0].spiegazione.trim() !== '') {
    console.log(`ℹ️ Spiegazione già esistente per ${politicoNome}, skip generazione`);
    return existingResult.rows[0].spiegazione;
  }

  // Usa la descrizione dal database se disponibile e non è stata passata
  const descrizioneDaUsare = descrizioneVotazione || (existingResult.rows.length > 0 ? existingResult.rows[0].descrizione_votazione : null);

  // Genera nuova spiegazione con titolo + descrizione
  const spiegazione = await generaSpiegazione(votazione, descrizioneDaUsare, camera, voto);
  
  if (spiegazione) {
    await salvaSpiegazione(politicoNome, spiegazione);
  }

  return spiegazione;
}

/**
 * Verifica il limite giornaliero di generazioni AI
 * @returns {Promise<{rispettato: boolean, count: number, limite: number}>}
 */
async function verificaLimiteGiornaliero() {
  const limiteGiornaliero = parseInt(process.env.OPENAI_DAILY_LIMIT || '50'); // Default: 50 al giorno
  
  try {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM voti_camera 
       WHERE spiegazione IS NOT NULL 
         AND spiegazione != ''
         AND ultimo_aggiornamento >= $1`,
      [oggi]
    );
    
    const count = parseInt(result.rows[0].count);
    
    return {
      rispettato: count < limiteGiornaliero,
      count,
      limite: limiteGiornaliero
    };
  } catch (error) {
    console.error('❌ Errore nella verifica limite giornaliero:', error);
    // In caso di errore, permettere la generazione (fail-open)
    return { rispettato: true, count: 0, limite: limiteGiornaliero };
  }
}

/**
 * Genera spiegazioni per tutte le votazioni senza spiegazione
 * @param {number} limit - Numero massimo di spiegazioni da generare (default: 10)
 * @returns {Promise<{successi: number, errori: number, limiteRaggiunto: boolean}>}
 */
async function generaSpiegazioniMancanti(limit = 10) {
  if (!aiClient) {
    console.warn('⚠️ Nessuna API AI configurata');
    return { successi: 0, errori: 0, limiteRaggiunto: false };
  }

  // Verifica limite giornaliero solo se non è Groq (che è completamente gratuito)
  let limitEffettivo = limit;
  if (aiProvider !== 'groq') {
    const limiteCheck = await verificaLimiteGiornaliero();
    if (!limiteCheck.rispettato) {
      console.warn(`⚠️ Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite}`);
      return { successi: 0, errori: 0, limiteRaggiunto: true };
    }

    // Calcola quante spiegazioni possiamo ancora generare oggi
    const rimanenti = limiteCheck.limite - limiteCheck.count;
    limitEffettivo = Math.min(limit, rimanenti);

    if (limitEffettivo <= 0) {
      console.warn(`⚠️ Nessuna spiegazione rimanente per oggi (${limiteCheck.count}/${limiteCheck.limite})`);
      return { successi: 0, errori: 0, limiteRaggiunto: true };
    }
  }

  try {
    // Recupera votazioni senza spiegazione
    const result = await pool.query(
      `SELECT politico_nome, votazione, descrizione_votazione, camera, voto 
       FROM voti_camera 
       WHERE votazione IS NOT NULL 
         AND votazione != ''
         AND (spiegazione IS NULL OR spiegazione = '')
       ORDER BY ultimo_aggiornamento DESC
       LIMIT $1`,
      [limitEffettivo]
    );

    if (result.rows.length === 0) {
      console.log('ℹ️ Nessuna votazione senza spiegazione trovata');
      return { successi: 0, errori: 0 };
    }

    console.log(`[*] Generazione spiegazioni per ${result.rows.length} votazioni...`);

    let successi = 0;
    let errori = 0;

    for (const row of result.rows) {
      try {
        const spiegazione = await generaESalvaSpiegazione(
          row.politico_nome,
          row.votazione,
          row.descrizione_votazione || null,
          row.camera,
          row.voto
        );

        if (spiegazione) {
          successi++;
        } else {
          errori++;
        }

        // Pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Errore per ${row.politico_nome}:`, error.message);
        errori++;
      }
    }

    console.log(`✅ Generazione completata: ${successi} successi, ${errori} errori`);
    const limiteFinale = await verificaLimiteGiornaliero();
    return { 
      successi, 
      errori, 
      limiteRaggiunto: !limiteFinale.rispettato,
      rimanenti: limiteFinale.limite - limiteFinale.count
    };
  } catch (error) {
    console.error('❌ Errore nella generazione spiegazioni mancanti:', error.message);
    return { successi: 0, errori: 0, limiteRaggiunto: false };
  }
}

module.exports = {
  generaSpiegazione,
  salvaSpiegazione,
  generaESalvaSpiegazione,
  generaSpiegazioniMancanti,
  verificaLimiteGiornaliero
};
