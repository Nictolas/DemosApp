'use strict';

// Real, bounded QA case based on public Italian parliamentary records.
// Official Camera: https://www.camera.it/leg19/126?ancora=&idDocumento=3131&leg=19
// Official Gazzetta: https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=26G00212&atto.dataPubblicazioneGazzetta=2026-10-26
// No database, user data, provider-output logs, persistence, or paid fallback.
const { resolveFreeGroqModel, isGroqConfigured } = require('../services/parliamentFreeAiPolicy');
const { requestFreeGroq, classifyFreeGroqError } = require('../services/parliamentFreeGroqBudget');

const CASE_ID = ['T002', 'T003', 'T006', 'T009', 'T010', 'T011', 'T012', 'T013', 'T018'].includes(process.env.GROQ_QA_CASE_ID) ? process.env.GROQ_QA_CASE_ID : 'T008';
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

// Senato: https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl/votazione?did=60317&sessionId=453&voteId=121
// Resoconto stenografico 14/09/2026, Allegato A:
// https://www.senato.it/show-doc?id=1520856&idoggetto=0&leg=19&part=doc_dc-allegatoa_aa-ddltit_ddldasda44c3dr1971-oggetto_a9ntadcdd-oggettoem_e&tipodoc=Resaula
const SECOND_LEGISLATURE_AMENDMENT_EVIDENCE = [
  'Senato della Repubblica, XIX legislatura, seduta 453 del 14/09/2026.',
  'Votazione elettronica sull’emendamento 9.0.2 di Pirondini, Boccia, De Cristofaro e Paita al disegno S.1971, esaminato insieme a S.61.',
  'Presenti 152, votanti 141, favorevoli 48, contrari 91, astenuti 2. Esito: RESPINTO.',
  'Testo dell’emendamento 9.0.2: aggiungere un articolo 9-bis, Entrata in vigore.',
  'La proposta stabiliva che la legge elettorale si applicasse a decorrere dalla seconda legislatura successiva alla sua approvazione.',
  'Non proponeva un termine fisso di 18 mesi: quello era l’emendamento distinto 9.0.3.',
  'L’emendamento 9.0.2 è stato respinto e non è diventato legge; non attribuire numero di legge, data di pubblicazione o entrata in vigore.'
].join(' ');

// Official Senate: https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?did=59909&tab=trattazioni_aula
// Text approved: https://www.senato.it/show-doc?id=1526543&idoggetto=0&leg=19&part=doc_dc-allegatoa_aa-ddltit_ddl1804&tipodoc=Resaula
// Parliamentary bills awaiting promulgation/publication: https://www.parlamento.it/leg/ldl_new/v3/sldlelencoddlappnonpub.htm
const ARCHIVE_EVIDENCE = [
  'Senato della Repubblica, XIX legislatura, seduta 469 del 28/10/2026.',
  'Votazione finale sul disegno di legge S.1804 (precedente C.2159), già approvato dalla Camera.',
  'Voto finale: 75 favorevoli, 52 contrari, 0 astenuti, 127 votanti, 128 presenti. Esito: APPROVATO DEFINITIVAMENTE.',
  'Oggetto: cambiare la denominazione dell’Archivio centrale dello Stato in Archivio nazionale;',
  'nel testo del provvedimento il soprintendente è ridenominato direttore dell’Archivio nazionale.',
  'Il testo è stato approvato definitivamente dal Parlamento il 28/10/2026 ma non risulta ancora pubblicato;',
  'non è indicato un numero di legge promulgata, né una data di pubblicazione o di entrata in vigore.',
  'Non presentare il cambio di denominazione come una norma già entrata in vigore.'
].join(' ');

// Official Senate vote: https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl/votazione?did=60425&sessionId=463&voteId=4
// Original amendment text: https://www.senato.it/show-doc?id=1523600&idoggetto=1517749&leg=19&tipodoc=EMEND
// The vote is on amendment 1.13 to S.2023, not on the entire law.
const ILVA_AMENDMENT_EVIDENCE = [
  'Senato XIX legislatura, seduta 463, 07/10/2026. Emendamento 1.13 Turco e altri al ddl S.2023 (decreto-legge 154/2026).',
  'Voto elettronico: presenti 122, votanti 121, 45 favorevoli, 75 contrari, 1 astenuto. Esito: RESPINTO.',
  'Testo emendamento: accordo di programma entro 30 giorni per risanare le aree industriali ex ILVA,',
  'con chiusura dell’area a caldo, tutela occupazionale e bonifica.',
  'La proposta respinta non ha disposto la chiusura né creato una legge; l’intero ddl ha un iter distinto.',
  'Numero legge, pubblicazione e entrata in vigore non si applicano a questo emendamento.'
].join(' ');

// Official Senate S.2023 electronic vote 07/10/2026:
// https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl/votazione?did=60425&sessionId=463&voteId=5
// Exact rejected amendment S.2023/1.0.6:
// https://www.senato.it/show-doc?id=1523603&idoggetto=1517749&leg=19&tipodoc=EMEND
// Another DDL (S.2029) also has an amendment 1.0.6 about fuel benefits:
// amendment number alone is NOT a reliable source identifier.
const LIABILITY_AMENDMENT_EVIDENCE = [
  'Senato XIX legislatura, seduta 463, 07/10/2026. Emendamento 1.0.6 Turco, Sabrina Licheri, Bevilacqua, Naturale al ddl S.2023.',
  'Votazione elettronica: presenti 123, votanti 122, favorevoli 47, contrari 74, astenuti 1. Esito: RESPINTO.',
  'Oggetto: disposizioni sulla responsabilità nella gestione degli stabilimenti industriali di interesse strategico.',
  'La proposta chiedeva di abrogare gli articoli 7 e 8 del decreto-legge 2/2023 e il comma 5 dell’articolo 9-bis del decreto-legge 69/2023.',
  'Questo emendamento NON è stato approvato; non confondere il voto con la conversione definitiva del ddl.',
  'Non attribuire numero di legge, data di pubblicazione o di entrata in vigore a questo emendamento respinto.'
].join(' ');

// Senate official record: https://www.senato.it/show-doc?id=1523304&leg=19&part=doc_dc&tipodoc=Resaula
// Senate bill status: https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl?did=60485&tab=datiGenerali
// Gazzetta Ufficiale: https://www.gazzettaufficiale.it/eli/id/2026/10/06/26G00194/sg
// This is a confidence vote ON the final conversion article: distinguish the vote date from promulgation/publication.
const CONFIDENCE_PA_EVIDENCE = [
  'Senato della Repubblica, XIX legislatura, seduta 460 del 30/09/2026.',
  'Votazione nominale con appello sulla questione di fiducia posta dal Governo sull’articolo unico del DDL S.2047,',
  'conversione del decreto-legge 7 agosto 2026 n.144, già approvato dalla Camera come C.3083.',
  'La materia riguarda la funzionalità della pubblica amministrazione, gli enti territoriali e la protezione civile.',
  'Voto sulla fiducia e sull’articolo unico: 95 favorevoli, 53 contrari, 2 astenuti, 150 votanti, 151 presenti.',
  'Il Senato approva definitivamente la conversione il 30/09/2026; la fiducia è approvata.',
  'Dopo il voto: legge 5 ottobre 2026 n.174, pubblicata sulla GU n.232 del 06/10/2026,',
  'entrata in vigore il 07/10/2026 secondo il testo della legge. Le tre date non coincidono.'
].join(' ');

function diagnoseLiabilityAmendmentExplanation(value) {
  const explanation = String(value || '');
  return {
    liabilitySubjectFound: /responsabilit|abrog|gestione/i.test(explanation) && /stabiliment|impiant|industrial/i.test(explanation),
    rejectedFound: /respint|bocciat|non approvat/i.test(explanation),
    wrongFuelSubjectFound: /carburant|benzina|buoni\s+benzina/i.test(explanation)
  };
}

function diagnoseIlvaAmendmentExplanation(value) {
  const explanation = String(value || '');
  return {
    hotAreaFound: /area\s+a\s+caldo/i.test(explanation),
    ilvaOrProgrammeFound: /ilva|accordo\s+di\s+programma/i.test(explanation),
    rejectedFound: /respint|bocciat|non approvat/i.test(explanation)
  };
}

// Official vote: https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl/votazione?did=60317&sessionId=453&voteId=120
// Original amendment: https://www.senato.it/show-doc?id=0&idoggetto=0&leg=19&part=doc_dc-allegatoa_aa-ddltit_ddldasda44c3dr1971-oggetto_a9ntadcdd&tipodoc=hotresaula
// S.61 was examined alongside and absorbed by S.1971, not itself the voted amendment's parent.
const CONDITIONAL_ELECTORAL_AMENDMENT_EVIDENCE = [
  'Senato, XIX legislatura, seduta 453 del 14/09/2026. Emendamento 9.0.1 di Giorgis e altri al ddl S.1971, discusso insieme a S.61.',
  'Voto elettronico: presenti 151, votanti 140, 48 favorevoli, 90 contrari, 2 astenuti. Esito: RESPINTO.',
  'La proposta riguardava quando applicare la nuova legge elettorale: in caso di approvazione nell’ultimo anno della legislatura,',
  'la legislatura immediatamente successiva solo con voto qualificato dei due terzi in entrambe le Camere;',
  'in mancanza di tale condizione, applicazione dalla seconda legislatura successiva.',
  'Non confondere questa condizione con emendamento 9.0.2 (solo seconda legislatura) né 9.0.3 (18 mesi dalla Gazzetta).',
  'Emendamento respinto: nessun numero di legge né data di pubblicazione o entrata in vigore si applica a questa proposta.'
].join(' ');

function diagnoseConditionalElectoralAmendment(value) {
  const explanation = String(value || '');
  return {
    thresholdFound: /(?:due\s+terzi|2\s*\/\s*3)/i.test(explanation),
    immediateLegislatureFound: /(?:immediatamente\s+successiv|prima\s+legislatura\s+successiv)/i.test(explanation),
    laterLegislatureFound: /seconda\s+legislatur/i.test(explanation),
    rejectedFound: /respint|bocciat|non\s+approvat/i.test(explanation),
    confusedWith18Months: /(?:18|diciotto)\s+mes/i.test(explanation)
  };
}

function diagnoseSecondLegislatureExplanation(value) {
  const explanation = String(value || '');
  return {
    secondLegislatureFound: /(?:seconda|2[ªa]?)\s+legislatur/i.test(explanation),
    rejectedFound: /respint|bocciat|non approvat/i.test(explanation),
    wrong18MonthFound: /(?:18|diciotto)\s*mes/i.test(explanation)
  };
}

function diagnoseAmendmentExplanation(value) {
  // Safe booleans only: no text from Groq is returned by the probe.
  const explanation = String(value || '');
  return {
    timingFound: /(?:18|diciotto)\s*mes/i.test(explanation),
    rejectedFound: /respint|bocciat|non approvat/i.test(explanation)
  };
}

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
      (() => { const checks = diagnoseAmendmentExplanation(explanation); return checks.timingFound && checks.rejectedFound; })()
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]), explanationDiagnostics: diagnoseAmendmentExplanation(explanation) };
  }
  if (caseId === 'T013') {
    const flags = diagnoseConditionalElectoralAmendment(answer.spiegazione);
    const checks = [
      /^(?:EM(?:ENDAMENTO)?\.?\s*)?9\.0\.1$/i.test(String(answer.atto || '').trim()),
      String(answer.data_voto || '') === '14/09/2026',
      Number(answer.favorevoli) === 48,
      Number(answer.contrari) === 90,
      Number(answer.astenuti) === 2,
      String(answer.esito || '').trim().toUpperCase() === 'RESPINTO',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      flags.thresholdFound && flags.immediateLegislatureFound &&
        flags.laterLegislatureFound && flags.rejectedFound && !flags.confusedWith18Months
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito',
      'numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length,
      failedFields: names.filter((_, i) => !checks[i]), explanationDiagnostics: flags };
  }
  if (caseId === 'T010') {
    const explanation = String(answer.spiegazione || '');
    const flags = diagnoseSecondLegislatureExplanation(explanation);
    const checks = [
      /^(?:EM(?:ENDAMENTO)?\.?\s*)?9\.0\.2$/i.test(String(answer.atto || '').trim()),
      String(answer.data_voto || '') === '14/09/2026',
      Number(answer.favorevoli) === 48,
      Number(answer.contrari) === 91,
      Number(answer.astenuti) === 2,
      String(answer.esito || '').trim().toUpperCase() === 'RESPINTO',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      flags.secondLegislatureFound && flags.rejectedFound && !flags.wrong18MonthFound
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]), explanationDiagnostics: flags };
  }
  if (caseId === 'T006') {
    const explanation = String(answer.spiegazione || '');
    const checks = [
      /^S\.?\s*1804$/i.test(String(answer.atto || '')),
      String(answer.data_voto || '') === '28/10/2026',
      Number(answer.favorevoli) === 75,
      Number(answer.contrari) === 52,
      Number(answer.astenuti) === 0,
      String(answer.esito || '').trim().toUpperCase() === 'APPROVATO DEFINITIVAMENTE',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      /archiv/i.test(explanation) && /nazional/i.test(explanation)
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]) };
  }
  if (caseId === 'T011') {
    const flags = diagnoseLiabilityAmendmentExplanation(answer.spiegazione);
    const checks = [
      /^(?:EM(?:ENDAMENTO)?\.?\s*)?1\.0\.6$/i.test(String(answer.atto || '').trim()),
      String(answer.data_voto || '') === '07/10/2026',
      Number(answer.favorevoli) === 47,
      Number(answer.contrari) === 74,
      Number(answer.astenuti) === 1,
      String(answer.esito || '').trim().toUpperCase() === 'RESPINTO',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      flags.liabilitySubjectFound && flags.rejectedFound && !flags.wrongFuelSubjectFound
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]), explanationDiagnostics: flags };
  }
  if (caseId === 'T012') {
    const flags = diagnoseIlvaAmendmentExplanation(answer.spiegazione);
    const checks = [
      /^(?:EM(?:ENDAMENTO)?\.?\s*)?1\.13$/i.test(String(answer.atto || '').trim()),
      String(answer.data_voto || '') === '07/10/2026',
      Number(answer.favorevoli) === 45,
      Number(answer.contrari) === 75,
      Number(answer.astenuti) === 1,
      String(answer.esito || '').trim().toUpperCase() === 'RESPINTO',
      answer.numero_legge == null,
      answer.data_pubblicazione == null,
      answer.data_entrata_in_vigore == null,
      flags.hotAreaFound && flags.ilvaOrProgrammeFound && flags.rejectedFound
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length, failedFields: names.filter((_, i) => !checks[i]), explanationDiagnostics: flags };
  }
  if (caseId === 'T018') {
    const explanation = String(answer.spiegazione || '');
    const confidenceTopic = /fiduci/i.test(explanation) &&
      /(pubblic[a-z]*\s+amministrazion|protezion[a-z]*\s+civil|enti\s+territorial)/i.test(explanation);
    const checks = [
      /^S\.?\s*2047$/i.test(String(answer.atto || '')),
      String(answer.data_voto || '') === '30/09/2026',
      Number(answer.favorevoli) === 95,
      Number(answer.contrari) === 53,
      Number(answer.astenuti) === 2,
      String(answer.esito || '').trim().toUpperCase() === 'APPROVATO DEFINITIVAMENTE',
      Number(answer.numero_legge) === 174,
      String(answer.data_pubblicazione || '') === '06/10/2026',
      String(answer.data_entrata_in_vigore || '') === '07/10/2026',
      confidenceTopic && !/respint|bocciat|non\s+definitiv/i.test(explanation)
    ];
    const names = ['atto','data_voto','favorevoli','contrari','astenuti','esito',
      'numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'];
    return { success: checks.every(Boolean), verifiedFields: checks.filter(Boolean).length,
      failedFields: names.filter((_, i) => !checks[i]) };
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
        { role: 'user', content: 'FONTE UFFICIALE: ' + (CASE_ID === 'T002' ? SENATE_EVIDENCE : CASE_ID === 'T003' ? ELECTORAL_EVIDENCE : CASE_ID === 'T009' ? AMENDMENT_EVIDENCE : CASE_ID === 'T010' ? SECOND_LEGISLATURE_AMENDMENT_EVIDENCE : CASE_ID === 'T006' ? ARCHIVE_EVIDENCE : CASE_ID === 'T012' ? ILVA_AMENDMENT_EVIDENCE : CASE_ID === 'T011' ? LIABILITY_AMENDMENT_EVIDENCE : CASE_ID === 'T018' ? CONFIDENCE_PA_EVIDENCE : CASE_ID === 'T013' ? CONDITIONAL_ELECTORAL_AMENDMENT_EVIDENCE : EVIDENCE) +
          '\nEstrai i seguenti campi JSON, con numeri come interi e date GG/MM/AAAA: ' +
          'atto (formato ' + (CASE_ID === 'T002' ? 'S.2023' : CASE_ID === 'T003' ? 'C.2822-B' : CASE_ID === 'T009' ? 'Em. 9.0.3' : CASE_ID === 'T010' ? 'Em. 9.0.2' : CASE_ID === 'T006' ? 'S.1804' : CASE_ID === 'T012' ? 'Em. 1.13' : CASE_ID === 'T011' ? 'Em. 1.0.6' : CASE_ID === 'T018' ? 'S.2047' : CASE_ID === 'T013' ? 'Em. 9.0.1' : 'C.3131') + '), data_voto, favorevoli, contrari, astenuti, esito, ' +
          'Il campo esito deve essere una delle seguenti stringhe esatte: APPROVATO DEFINITIVAMENTE, APPROVATO NON DEFINITIVAMENTE, RESPINTO, NON DETERMINABILE. ' +
          'Determina autonomamente quale esito è sostenuto dalla fonte, distinguendo il voto del ramo dalla conclusione dell’intero iter legislativo. ' +
          'numero_legge, data_pubblicazione, data_entrata_in_vigore, spiegazione. Se la fonte non collega al voto una legge già promulgata, restituisci null per i campi relativi alla legge; non attribuire al voto di un ramo dati di una legge successiva. ' +
          'Per esito, usa esclusivamente una delle quattro stringhe ammesse in base alla fonte, senza presumere la definitività. ' +
          'Spiegazione: massimo due frasi; indica l\'ambito materiale specifico dell\'atto con un termine distintivo presente nella fonte e l\'esito del voto del ramo indicato. Se si tratta di un emendamento, descrivi la condizione concreta, la soglia o il termine temporale proposto, se documentato, e l\'esito di quel singolo emendamento (non della legge). Non limitarti a riportare il numero del provvedimento; ' +
          'non chiamare il voto del 20/10 data di promulgazione e non inventare voti individuali.' }
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      temperature: 0,
      max_completion_tokens: 1100
    });
    // A null response means the shared Free budget or provider admission gate
    // declined this call. It is not evidence of an empty model generation.
    if (!completion) {
      return { caseId: CASE_ID, status: 'FREE_QUOTA_UNAVAILABLE', success: false, verifiedFields: 0 };
    }
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

module.exports = { CASE_ID, EVIDENCE, diagnoseSenateExplanation, diagnoseAmendmentExplanation, diagnoseSecondLegislatureExplanation, diagnoseIlvaAmendmentExplanation, diagnoseLiabilityAmendmentExplanation, diagnoseConditionalElectoralAmendment, assessOfficialAnswer, runOfficialCaseQA };
