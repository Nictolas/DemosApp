'use strict';

// Real, bounded QA case based on public Italian parliamentary records.
// Official Camera: https://www.camera.it/leg19/126?ancora=&idDocumento=3131&leg=19
// Official Gazzetta: https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=26G00212&atto.dataPubblicazioneGazzetta=2026-10-26
// No database, user data, provider-output logs, persistence, or paid fallback.
const { resolveFreeGroqModel, isGroqConfigured } = require('../services/parliamentFreeAiPolicy');
const { requestFreeGroq, classifyFreeGroqError } = require('../services/parliamentFreeGroqBudget');

const CASE_ID = ['T002', 'T003', 'T009'].includes(process.env.GROQ_QA_CASE_ID) ? process.env.GROQ_QA_CASE_ID : 'T008';
const EVIDENCE = [
  'Camera dei deputati, XIX legislatura, seduta 729 del 20/10/2026.',
  'Votazione finale A.C. 3131: 125 favorevoli, 43 contrari, 52 astenuti, 168 votanti, 220 presenti.',
  'Esito: la Camera approva definitivamente.',
  'Oggetto: conversione in legge, con modificazioni, del decreto-legge 28 agosto 2026 n. 154,',
  'misure urgenti per assicurare la continuità operativa di impianti di interesse strategico nazionale.',
  'Gazzetta Ufficiale: legge n. 196 del 23/10/2026, pubblicata il 26/10/2026, in vigore dal 27/10/2026.'
].join(' ');

const SENATE_EVIDENCE = [
  'Senato della Repubblica, XIX legislatura, seduta 463 del 07/10/2026.',
  'Votazione finale S.2023: 73 favorevoli, 49 contrari, 3 astenuti, 125 votanti, 126 presenti.',
  'Esito: approvato con modificazioni, non definitivamente; il provvedimento prosegue alla Camera come C.3131.',
  'Oggetto: conversione del decreto-legge 28 agosto 2026 n.154 sulla continuità operativa di impianti strategici.',
  'La Camera approverà definitivamente il successivo 20/10/2026: questa NON è la data del voto del Senato.'
].join(' ');

// Official Camera vote: https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?Legislatura=19&RifVotazione=723_1&tipo=dettaglio
// Official bill: https://www.camera.it/leg19/126?idDocumento=2822-B
// Published law: https://www.normattiva.it/eli/id/2026/10/09/26G00201/ORIGINAL
const ELECTORAL_EVIDENCE = [
  'Camera dei deputati, XIX legislatura, seduta 723 del 08/10/2026.',
  'Votazione finale segreta sulla proposta C.2822-B, disposizioni in materia di elezioni della Camera dei deputati e del Senato.',
  'Risultato: presenti 391, votanti 391, 227 favorevoli, 164 contrari, zero astenuti; la Camera approva definitivamente.',
  'Iter istituzionale: la Camera ha approvato dopo le modifiche del Senato (S.1971).',
  'Legge 9 ottobre 2026 n. 180, pubblicata sulla Gazzetta Ufficiale n. 235 il 09/10/2026, in vigore dal 24/10/2026.',
  'Non confondere il voto parlamentare del 08/10 con la data della legge e della sua entrata in vigore.'
].join(' ');

// Senate vote: https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl/votazione?did=60317&sessionId=453&voteId=122
// Official text, Aula Allegato A, 14/09/2026:
// https://www.senato.it/show-doc?id=0&idoggetto=0&leg=19&part=doc_dc-allegatoa_aa-ddltit_ddldasda44c3dr1971-oggetto_a9ntadcdd&tipodoc=hotresaula
// S.61 was considered jointly and absorbed by S.1971, not a separately rejected bill.
const AMENDMENT_EVIDENCE = [
  'Senato della Repubblica, XIX legislatura, seduta 453 del 14/09/2026.',
  'Votazione nominale elettronica sull’emendamento 9.0.3 (Cataldi, Maiorino, Gaudiano) al testo del disegno elettorale S.1971, esaminato con S.61.',
  'Votanti 138: favorevoli 47, contrari 89, astenuti 2; presenti 151. Esito ufficiale: RESPINTO.',
  'Testo emendamento 9.0.3: aggiungere un articolo 9-bis in materia di entrata in vigore;',
  'la proposta stabiliva che la legge entrasse in vigore dopo 18 mesi dalla pubblicazione in Gazzetta Ufficiale.',
  'L’emendamento è stato respinto: la sua clausola dei 18 mesi NON è diventata norma.',
  'Questo è il voto su un emendamento, non il voto finale sul disegno di legge.',
  'Non associare all’emendamento respinto numero di legge, data di pubblicazione o data di entrata in vigore.'
].join(' ');

function diagnoseSenateExplanation(value) {
  // Diagnostic flags only: no model text is logged or returned by the public probe.
  const explanation = String(value || '');
  return {
    topicFound: /impiant|continuit/i.test(explanation),
    definitivePhraseFound: /approvat[oa] definitivamente/i.test(explanation)
  };
}

function assessOfficialAnswer(answer, caseId = CASE_ID) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
    return { success: false, verifiedFields: 0 };
  }
  if (caseId === 'T002') {
    const checks = [
      /^S\.?\s*2023$/i.test(String(answer.atto || '')),
      String(answer.data_voto || '') === '07/10/2026',
      Number(answer.favorevoli) === 73,
      Number(answer.contrari) === 49,
      Number(answer.astenuti) === 3,
      String(answer.esito || '') === 'APPROVATO NON DEFINITIVAMENTE',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      (() => { const flags = diagnoseSenateExplanation(answer.spiegazione); return flags.topicFound && !flags.definitivePhraseFound; })()
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]), explanationDiagnostics: diagnoseSenateExplanation(answer.spiegazione) };
  }
  if (caseId === 'T009') {
    const explanation = String(answer.spiegazione || '');
    const checks = [
      /^(?:EM(?:ENDAMENTO)?\.?\s*)?9\.0\.3$/i.test(String(answer.atto || '').trim()),
      String(answer.data_voto || '') === '14/09/2026',
      Number(answer.favorevoli) === 47,
      Number(answer.contrari) === 89,
      Number(answer.astenuti) === 2,
      String(answer.esito || '').trim().toUpperCase() === 'RESPINTO',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      /(?:18|diciotto)\s*mes/i.test(explanation) && /respint|bocciat|non approvat/i.test(explanation)
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]) };
  }
  if (caseId === 'T003') {
    const checks = [
      /^C\.?\s*2822\s*[-‑]\s*B$/i.test(String(answer.atto || '')),
      String(answer.data_voto || '') === '08/10/2026',
      Number(answer.favorevoli) === 227,
      Number(answer.contrari) === 164,
      Number(answer.astenuti) === 0,
      String(answer.esito || '').trim().toUpperCase() === 'APPROVATO DEFINITIVAMENTE',
      Number(answer.numero_legge) === 180,
      String(answer.data_pubblicazione || '') === '09/10/2026',
      String(answer.data_entrata_in_vigore || '') === '24/10/2026',
      /elezion|elettoral/i.test(String(answer.spiegazione || ''))
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]) };
  }
  const checks = [
    String(answer.atto || '').replace(/[^0-9]/g, '') === '3131',
    String(answer.data_voto || '') === '20/10/2026',
    Number(answer.favorevoli) === 125,
    Number(answer.contrari) === 43,
    Number(answer.astenuti) === 52,
    /\bapprova(?:t[oa]|zione)\b.{0,100}\bdefinitiv|\bdefinitiv.{0,100}\bapprova(?:t[oa]|zione)\b/i.test(String(answer.esito || '')),
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
        { role: 'user', content: 'FONTE UFFICIALE: ' + (CASE_ID === 'T002' ? SENATE_EVIDENCE : CASE_ID === 'T003' ? ELECTORAL_EVIDENCE : CASE_ID === 'T009' ? AMENDMENT_EVIDENCE : EVIDENCE) +
          '\nEstrai i seguenti campi JSON, con numeri come interi e date GG/MM/AAAA: ' +
          'atto (formato ' + (CASE_ID === 'T002' ? 'S.2023' : CASE_ID === 'T003' ? 'C.2822-B' : CASE_ID === 'T009' ? 'Em. 9.0.3' : 'C.3131') + '), data_voto, favorevoli, contrari, astenuti, esito, ' +
          'Il campo esito deve essere una delle seguenti stringhe esatte: APPROVATO DEFINITIVAMENTE, APPROVATO NON DEFINITIVAMENTE, RESPINTO, NON DETERMINABILE. ' +
          'Determina autonomamente quale esito è sostenuto dalla fonte, distinguendo il voto del ramo dalla conclusione dell’intero iter legislativo. ' +
          'numero_legge, data_pubblicazione, data_entrata_in_vigore, spiegazione. Se la fonte non collega al voto una legge già promulgata, restituisci null per i campi relativi alla legge; non attribuire al voto di un ramo dati di una legge successiva. ' +
          'Per esito, usa esclusivamente una delle quattro stringhe ammesse in base alla fonte, senza presumere la definitività. ' +
          'Spiegazione: massimo due frasi; indica l\'ambito materiale specifico dell\'atto con un termine distintivo presente nella fonte e l\'esito del voto del ramo indicato. Non limitarti a riportare il numero del provvedimento; ' +
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

module.exports = { CASE_ID, EVIDENCE, diagnoseSenateExplanation, assessOfficialAnswer, runOfficialCaseQA };
