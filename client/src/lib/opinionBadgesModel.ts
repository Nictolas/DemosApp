/**
 * DEMOS — PROTOTIPO ISOLATO, NON COLLEGATO ALL'APP.
 *
 * Nessuna regola e approvata: questa mappa non puo produrre targhette in produzione.
 * L'attivazione richiede revisione DPO, trattamento specifico/consenso verificato,
 * gating del proprietario e una release separatamente autorizzata.
 * Nessuna rete, database, memorizzazione, analytics o side effect.
 */
export const BADGE_RULES_VERSION = "2026-11-01-draft-1";
export type BadgeId = "B01" | "B02" | "B03" | "B04" | "B05";
export type Answer = "f" | "c" | "i";

export interface BadgeQuestion {
  readonly opinionId: string;
  readonly supportsBadge: "f" | "c";
  readonly topic: string;
}
export interface BadgeRule {
  readonly id: BadgeId;
  readonly label: string;
  /** Resta false fino alla convalida semantica/privacy e al gate release. */
  readonly approved: boolean;
  readonly questions: readonly BadgeQuestion[];
}
type Mapping = readonly [opinionId: string, expected: "f" | "c", topic: string];
const defineRule = (id: BadgeId, label: string, entries: readonly Mapping[]): BadgeRule => ({
  id,
  label,
  approved: false,
  questions: entries.map(([opinionId, supportsBadge, topic]) => ({ opinionId, supportsBadge, topic })),
});

/** Solo le 24 associazioni candidate del piano: 2 escluse dal MVP e nessun tema identitario. */
export const BADGE_RULES: readonly BadgeRule[] = [
  defineRule("B01", "Tutela animale", [
    ["caccia", "c", "caccia"],
    ["abbattimento_cinghiali", "c", "controllo-fauna"],
    ["allevamenti_intensivi", "c", "allevamento"],
    ["sperimentazione_animale", "c", "ricerca"],
    ["corrida", "c", "spettacoli"],
  ]),
  defineRule("B02", "Ambiente e natura", [
    ["nuove_aree_naturali_protette", "f", "biodiversita"],
    ["potenziare_rinnovabili", "f", "transizione-energetica"],
    ["nuovi_parchi_eolici", "f", "transizione-energetica"],
    ["verde_pubblico_e_giardini", "f", "verde-urbano"],
  ]),
  defineRule("B03", "Mobilita sostenibile", [
    ["nuove_piste_ciclabili", "f", "ciclabilita"],
    ["potenziamento_trasporto_pubblico", "f", "trasporto-collettivo"],
    ["pedonalizzazione_centro_storico", "f", "pedonalita"],
    ["estensione_delle_zone_a_traffico_limitato", "f", "accesso-auto"],
  ]),
  defineRule("B04", "Diritti civili", [
    ["matrimonio_gay", "f", "matrimonio"],
    ["adozioni_omogenitoriali", "f", "adozioni"],
    ["omobitransfobia", "f", "antidiscriminazione"],
    ["educazione_sessuale", "f", "educazione"],
    ["aborto_farmacologico_consultori", "f", "diritti-riproduttivi"],
  ]),
  defineRule("B05", "Welfare e servizi pubblici", [
    ["salario_minimo", "f", "lavoro"],
    ["reddito_di_cittadinanza", "f", "sostegno-reddito"],
    ["reddito_minimo_regionale", "f", "sostegno-reddito"],
    ["nuove_case_popolari", "f", "abitazione"],
    ["asili_nido_gratuiti", "f", "servizi-infanzia"],
    ["nuovi_asili_nido_comunali", "f", "servizi-infanzia"],
  ]),
];

/** Le risposte f/c esprimono accordo/disaccordo con una proposta, non identita. */
export function normalizeBadgeAnswer(raw: unknown): Answer | null {
  if (typeof raw !== "string") return null;
  switch (raw.trim().toLocaleLowerCase("it")) {
    case "f": case "favorevole": return "f";
    case "c": case "contrario": return "c";
    case "i": case "indeciso": case "non lo so":
    case "non_lo_so": case "non-lo-so": return "i";
    default: return null;
  }
}
export interface BadgeAccess {
  readonly isOwner: boolean;
  readonly politicalConsentVerified: boolean;
  readonly badgeConsentVerified: boolean;
  readonly releaseGateApproved: boolean;
}
export interface BadgeEvidence {
  readonly opinionId: string;
  readonly answer: "f" | "c";
  readonly supportsBadge: boolean;
  readonly topic: string;
}
export interface BadgeResult {
  readonly badgeId: BadgeId;
  readonly version: string;
  readonly eligible: boolean;
  readonly decisive: number;
  readonly coherent: number;
  readonly contradictory: number;
  readonly undecided: number;
  readonly missing: number;
  readonly coverage: number;
  readonly coherence: number | null;
  readonly distinctTopics: number;
  readonly evidence: readonly BadgeEvidence[];
}

/**
 * Returns null (without inspecting answers) unless every access gate is true.
 * Even an explicitly permitted preview cannot emit labels while rule.approved=false.
 * Values are derived only in memory and must never be persisted or logged.
 */
export function evaluateOpinionBadge(
  rule: BadgeRule,
  answers: Readonly<Record<string, unknown>>,
  access: BadgeAccess,
): BadgeResult | null {
  if (access.isOwner !== true ||
      access.politicalConsentVerified !== true ||
      access.badgeConsentVerified !== true ||
      access.releaseGateApproved !== true ||
      rule.approved !== true) {
    return null;
  }

  const evidence: BadgeEvidence[] = [];
  const groups = new Set<string>();
  let decisive = 0;
  let coherent = 0;
  let undecided = 0;
  let missing = 0;
  for (const question of rule.questions) {
    const answer = normalizeBadgeAnswer(answers[question.opinionId]);
    if (answer === null) { missing++; continue; }
    if (answer === "i") { undecided++; continue; }
    decisive++;
    groups.add(question.topic);
    const supportsBadge = answer === question.supportsBadge;
    if (supportsBadge) coherent++;
    evidence.push({ opinionId: question.opinionId, answer, supportsBadge, topic: question.topic });
  }

  const coverage = rule.questions.length === 0 ? 0 : decisive / rule.questions.length;
  const coherence = decisive === 0 ? null : coherent / decisive;
  const eligible = decisive >= 3 && coverage >= 0.6 &&
    coherence !== null && coherence >= 0.75 && groups.size >= 2;
  return {
    badgeId: rule.id, version: BADGE_RULES_VERSION, eligible,
    decisive, coherent, contradictory: decisive - coherent, undecided, missing,
    coverage, coherence, distinctTopics: groups.size, evidence,
  };
}
