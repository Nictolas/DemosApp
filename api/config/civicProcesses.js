'use strict';

const { JURISDICTIONS } = require('./jurisdictions');

const CIVIC_PROCESS_STAGES = Object.freeze({
  SIGNATURE_COLLECTION: 'signature_collection',
  QUALIFIED: 'qualified',
  PARLIAMENTARY_REVIEW: 'parliamentary_review',
  COLLECTION_CLOSED: 'collection_closed',
  BALLOT_SCHEDULED: 'ballot_scheduled',
  CLOSED: 'closed',
  REJECTED: 'rejected',
});

const SOURCE_ADAPTERS = Object.freeze({
  'it.justice.signature_portal': Object.freeze({
    id: 'it.justice.signature_portal',
    jurisdictionId: 'it',
    authority: 'Ministero della Giustizia',
    kind: 'official_signature_portal',
  }),
  'it.parliament.camera': Object.freeze({
    id: 'it.parliament.camera',
    jurisdictionId: 'it',
    authority: 'Camera dei deputati',
    kind: 'official_legislative_source',
  }),
  'it.parliament.senate': Object.freeze({
    id: 'it.parliament.senate',
    jurisdictionId: 'it',
    authority: 'Senato della Repubblica',
    kind: 'official_legislative_source',
  }),
});

const INFORMATION_ONLY = Object.freeze({
  information: true,
  external_signature: false,
  demos_priority: false,
  position_on_question: false,
});

const CIVIC_PROCESS_TYPES = Object.freeze({
  'it.popular_law_initiative': Object.freeze({
    id: 'it.popular_law_initiative',
    jurisdictionId: 'it',
    family: 'popular_initiative',
    label: 'Legge di iniziativa popolare',
    rules: Object.freeze({ signatureThreshold: 50000 }),
    stageOrder: Object.freeze({
      [CIVIC_PROCESS_STAGES.SIGNATURE_COLLECTION]: 10,
      [CIVIC_PROCESS_STAGES.QUALIFIED]: 20,
      [CIVIC_PROCESS_STAGES.COLLECTION_CLOSED]: 20,
      [CIVIC_PROCESS_STAGES.PARLIAMENTARY_REVIEW]: 30,
      [CIVIC_PROCESS_STAGES.CLOSED]: 90,
      [CIVIC_PROCESS_STAGES.REJECTED]: 90,
    }),
    sourceBindings: Object.freeze([
      Object.freeze({
        sourceId: 'it.justice.signature_portal',
        matcher: Object.freeze({ includeAll: Object.freeze(['iniziativa']), excludeAny: Object.freeze(['referendum']) }),
        legacySqlLikePatterns: Object.freeze(['%Legge%di%iniziativa%popolare%']),
        stageMap: Object.freeze({
          in_corso: CIVIC_PROCESS_STAGES.SIGNATURE_COLLECTION,
          conclusa: CIVIC_PROCESS_STAGES.COLLECTION_CLOSED,
          approvata: CIVIC_PROCESS_STAGES.QUALIFIED,
          rifiutata: CIVIC_PROCESS_STAGES.REJECTED,
        }),
      }),
      Object.freeze({ sourceId: 'it.parliament.camera' }),
      Object.freeze({ sourceId: 'it.parliament.senate' }),
    ]),
    demosActionPolicies: Object.freeze({
      [CIVIC_PROCESS_STAGES.SIGNATURE_COLLECTION]: Object.freeze({ information: true, external_signature: true, demos_priority: false, position_on_question: false }),
      [CIVIC_PROCESS_STAGES.QUALIFIED]: Object.freeze({ information: true, external_signature: false, demos_priority: true, position_on_question: false }),
      [CIVIC_PROCESS_STAGES.PARLIAMENTARY_REVIEW]: Object.freeze({ information: true, external_signature: false, demos_priority: true, position_on_question: false }),
      [CIVIC_PROCESS_STAGES.COLLECTION_CLOSED]: Object.freeze({ information: true, external_signature: false, demos_priority: true, position_on_question: false }),
      [CIVIC_PROCESS_STAGES.CLOSED]: Object.freeze({ information: true, external_signature: false, demos_priority: true, position_on_question: false }),
      [CIVIC_PROCESS_STAGES.REJECTED]: Object.freeze({ information: true, external_signature: false, demos_priority: true, position_on_question: false }),
    }),
  }),

  // Adapter transitorio per il portale firme italiano. Oggi la route legacy raggruppa
  // referendum abrogativi e costituzionali; il core non deve assumere che siano lo stesso
  // istituto giuridico. Il prossimo adapter potrà separarli senza cambiare il contratto.
  'it.referendum_signature_request': Object.freeze({
    id: 'it.referendum_signature_request',
    jurisdictionId: 'it',
    family: 'referendum',
    label: 'Richiesta di referendum',
    rules: Object.freeze({ signatureThreshold: 500000 }),
    stageOrder: Object.freeze({
      [CIVIC_PROCESS_STAGES.SIGNATURE_COLLECTION]: 10,
      [CIVIC_PROCESS_STAGES.QUALIFIED]: 20,
      [CIVIC_PROCESS_STAGES.COLLECTION_CLOSED]: 20,
      [CIVIC_PROCESS_STAGES.BALLOT_SCHEDULED]: 30,
      [CIVIC_PROCESS_STAGES.CLOSED]: 90,
      [CIVIC_PROCESS_STAGES.REJECTED]: 90,
    }),
    sourceBindings: Object.freeze([
      Object.freeze({
        sourceId: 'it.justice.signature_portal',
        matcher: Object.freeze({ includeAny: Object.freeze(['referendum']) }),
        legacySqlLikePatterns: Object.freeze(['%Referendum%abrogativo%', '%Referendum%costituzionale%']),
        stageMap: Object.freeze({
          in_corso: CIVIC_PROCESS_STAGES.SIGNATURE_COLLECTION,
          conclusa: CIVIC_PROCESS_STAGES.COLLECTION_CLOSED,
          approvata: CIVIC_PROCESS_STAGES.QUALIFIED,
          rifiutata: CIVIC_PROCESS_STAGES.REJECTED,
        }),
      }),
    ]),
    demosActionPolicies: Object.freeze({
      [CIVIC_PROCESS_STAGES.SIGNATURE_COLLECTION]: Object.freeze({ information: true, external_signature: true, demos_priority: false, position_on_question: false }),
      [CIVIC_PROCESS_STAGES.QUALIFIED]: INFORMATION_ONLY,
      [CIVIC_PROCESS_STAGES.COLLECTION_CLOSED]: INFORMATION_ONLY,
      [CIVIC_PROCESS_STAGES.BALLOT_SCHEDULED]: INFORMATION_ONLY,
      [CIVIC_PROCESS_STAGES.CLOSED]: INFORMATION_ONLY,
      [CIVIC_PROCESS_STAGES.REJECTED]: INFORMATION_ONLY,
    }),
  }),
});

const LEGACY_PROCESS_ALIASES = Object.freeze({
  iniziativa: 'it.popular_law_initiative',
  referendum: 'it.referendum_signature_request',
});

module.exports = {
  JURISDICTIONS,
  CIVIC_PROCESS_STAGES,
  SOURCE_ADAPTERS,
  CIVIC_PROCESS_TYPES,
  LEGACY_PROCESS_ALIASES,
};
