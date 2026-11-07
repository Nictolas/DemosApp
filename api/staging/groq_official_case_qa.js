'use strict';

// Real, bounded QA case based on public Italian parliamentary records.
// Official Camera: https://www.camera.it/leg19/126?ancora=&idDocumento=3131&leg=19
// Official Gazzetta: https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=26G00212&atto.dataPubblicazioneGazzetta=2026-10-26
// No database, user data, provider-output logs, persistence, or paid fallback.
const { resolveFreeGroqModel, isGroqConfigured } = require('../services/parliamentFreeAiPolicy');
const { requestFreeGroq, classifyFreeGroqError } = require('../services/parliamentFreeGroqBudget');

const CASE_ID = 'T008';
const EVIDENCE = [
  'Camera dei deputati, XIX legislatura, seduta 729 del 20/10/2026.',
  'Votazione finale A.C. 3131: 125 favorevoli, 43 contrari, 52 astenuti, 168 votanti, 220 presenti.',
  'Esito: la Camera approva definitivamente.',
  'Oggetto: conversione in legge, con modificazioni, del decreto-legge 28 agosto 2026 n. 154,',
  'misure urgenti per assicurare la continuità operativa di impianti di interesse strategico nazionale.',
  'Gazzetta Ufficiale: legge n. 196 del 23/10/2026, pubblicata il 26/10/2026, in vigore dal 27/10/2026.'
].join(' ');

function assessOfficialAnswer(answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
    return { success: false, verifiedFields: 0 };
  }
  const checks = [
    String(answer.atto || '').replace(/[^0-9]/g, '') === '3131',
    String(answer.data_voto || '') === '20/10/2026',
    Number(answer.favorevoli) === 125,
    Number(answer.contrari) === 43,
    Number(answer.astenuti) === 52,
    /approvat[oa]\s+definitivamente/i.test(String(answer.esito || '')),
    Number(answer.numero_legge) === 196,
    String(answer.data_pubblicazione || '') === '26/10/2026',
    String(answer.data_entrata_in_vigore || '') === '27/10/2026',
    /continu[it][aà]|impiant/i.test(String(answer.spiegazione || ''))
  ];
  const verifiedFields = checks.filter(Boolean).length;
  const names = ['atto', 'data_voto', 'favorevoli', 'contrari', 'astenuti', 'esito', 'numero_legge', 'data_pubblicazione', 'data_entrata_in_vigore', 'spiegazione'];
  return { success: verifiedFields === checks.length, verifiedFields, failedFields: names.filter((_, index) => !checks[index]) };
}

async function runOfficialCaseQA({
  env = process.env,
  clientFactory,
  request = requestFreeGroq,
  now = Date.now
} = {}) {
  if (!isGroqConfigured(env)) {
    return { caseId: CASE_ID, status: 'NOT_CONFIGURED', success: false, verifiedFields: 0 };
  }
  let model;
  try {
    model = resolveFreeGroqModel(env.GROQ_MODEL);
  } catch (_) {
    return { caseId: CASE_ID, status: 'MODEL_NOT_ALLOWED', success: false, verifiedFields: 0 };
  }

  const began = now();
  try {
    const factory = clientFactory || (apiKey => {
      const Groq = require('groq-sdk');
      return new Groq({ apiKey, maxRetries: 0, timeout: 20000 });
    });
    const client = factory(env.GROQ_API_KEY);
    const completion = await request(client, {
      model,
      messages: [
        { role: 'system', content: 'Sei un verificatore di dati parlamentari. Usa ESCLUSIVAMENTE la fonte fornita. Non inventare fatti. Rispondi solo con un oggetto JSON conforme alle chiavi richieste.' },
        { role: 'user', content: 'FONTE UFFICIALE: ' + EVIDENCE +
          '\nEstrai i seguenti campi JSON, con numeri come interi e date GG/MM/AAAA: ' +
          'atto (formato C.3131), data_voto, favorevoli, contrari, astenuti, esito, ' +
          'numero_legge, data_pubblicazione, data_entrata_in_vigore, spiegazione. ' +
          'Spiegazione: massimo due frasi, descrivi solo oggetto della legge e cosa ha votato la Camera; ' +
          'non chiamare il voto del 20/10 data di promulgazione e non inventare voti individuali.' }
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      temperature: 0,
      max_completion_tokens: 1100
    });
    const choice = completion?.choices?.[0];
    if (choice?.finish_reason !== 'stop' ||
        typeof choice?.message?.content !== 'string' ||
        !choice.message.content.trim()) {
      return { caseId: CASE_ID, status: 'EMPTY_OR_TRUNCATED', success: false, verifiedFields: 0 };
    }
    let obj;
    try {
      obj = JSON.parse(choice.message.content);
    } catch (_) {
      return { caseId: CASE_ID, status: 'INVALID_JSON', success: false, verifiedFields: 0 };
    }
    const assessment = assessOfficialAnswer(obj);
    const elapsed = Math.max(0, now() - began);
    return {
      caseId: CASE_ID,
      status: assessment.success ? 'OK' : 'SOURCE_MISMATCH',
      ...assessment,
      latencyMs: Math.min(120000, Math.round(elapsed))
    };
  } catch (error) {
    return {
      caseId: CASE_ID, status: classifyFreeGroqError(error),
      success: false, verifiedFields: 0
    };
  }
}

module.exports = { CASE_ID, EVIDENCE, assessOfficialAnswer, runOfficialCaseQA };
