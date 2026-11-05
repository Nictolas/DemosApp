// Prototipo ESPLORATIVO: non e una misura validata di ideologia politica.
// Ogni regola deve essere rivista prima di una possibile pubblicazione.
export type CompassDimension = "economia" | "liberta";
export type CompassDirection = -1 | 1;

export interface CompassQuestion {
  id: string;
  label: string;
  axis: CompassDimension;
  direction: CompassDirection;
}

// Una piccola selezione delle 94 Opinioni. Questioni territoriali o con
// significati trasversali non vengono tradotte forzatamente in coordinate.
// direction -1: sostegno a interventi economico-sociali pubblici
// (economia) / maggiori restrizioni (liberta).
// direction +1: sostegno a soluzioni private/concorrenziali (economia)
// / maggiori liberta (liberta). NON indica un'identita ideologica.
export const COMPASS_QUESTIONS: readonly CompassQuestion[] = [
  { id: "patrimoniale", label: "Patrimoniale", axis: "economia", direction: -1 },
  { id: "salario_minimo", label: "Salario minimo", axis: "economia", direction: -1 },
  { id: "reddito_di_cittadinanza", label: "Reddito di cittadinanza", axis: "economia", direction: -1 },
  { id: "reddito_minimo_regionale", label: "Reddito minimo regionale", axis: "economia", direction: -1 },
  { id: "nuove_case_popolari", label: "Nuove case popolari", axis: "economia", direction: -1 },
  { id: "asili_nido_gratuiti", label: "Asili nido gratuiti", axis: "economia", direction: -1 },
  { id: "nuovi_asili_nido_comunali", label: "Nuovi asili nido comunali", axis: "economia", direction: -1 },
  { id: "abolizione_ticket_regionali", label: "Abolizione dei ticket regionali", axis: "economia", direction: -1 },
  { id: "multe_in_base_al_reddito", label: "Multe in base al reddito", axis: "economia", direction: -1 },
  { id: "limitazioni_affitti_brevi", label: "Limitazioni affitti brevi", axis: "economia", direction: -1 },
  { id: "trasporto_pubblico_gratuito", label: "Trasporto pubblico gratuito", axis: "economia", direction: -1 },
  { id: "treni_regionali_gratuiti", label: "Treni regionali gratuiti", axis: "economia", direction: -1 },
  { id: "gare_treni_regionali", label: "Gare per i treni regionali", axis: "economia", direction: 1 },
  { id: "sanita_privata_convenzionata", label: "Sanita privata convenzionata", axis: "economia", direction: 1 },
  { id: "finanziamento_rsa_private", label: "Finanziamento delle RSA private", axis: "economia", direction: 1 },
  { id: "finanziamento_scuole_paritarie", label: "Finanziamento scuole paritarie", axis: "economia", direction: 1 },

  { id: "adozioni_omogenitoriali", label: "Adozioni omogenitoriali", axis: "liberta", direction: 1 },
  { id: "matrimonio_gay", label: "Matrimonio gay", axis: "liberta", direction: 1 },
  { id: "eutanasia", label: "Eutanasia", axis: "liberta", direction: 1 },
  { id: "legalizzazione_canapa", label: "Legalizzazione canapa", axis: "liberta", direction: 1 },
  { id: "aborto_farmacologico_consultori", label: "Aborto farmacologico nei consultori", axis: "liberta", direction: 1 },
  { id: "case_chiuse", label: "Case chiuse", axis: "liberta", direction: 1 },
  { id: "gestazione_per_altri", label: "Gestazione per altri (altruistica)", axis: "liberta", direction: 1 },
  { id: "videosorveglianza_in_spazi_pubblici", label: "Videosorveglianza in spazi pubblici", axis: "liberta", direction: -1 },
  { id: "leva_obbligatoria", label: "Leva obbligatoria", axis: "liberta", direction: -1 },
  { id: "abolizione_contante", label: "Abolizione contante", axis: "liberta", direction: -1 },
  { id: "restrizioni_sale_gioco", label: "Restrizioni alle sale gioco", axis: "liberta", direction: -1 },
  { id: "limitazioni_movida_notturna", label: "Limitazioni alla movida notturna", axis: "liberta", direction: -1 },
];

// Le risposte f/c misurano l'accordo con la specifica proposta.
// "Indeciso", valori mancanti o sconosciuti NON equivalgono a una posizione centrale.
export function readCompassAnswer(value: unknown): -1 | 0 | 1 | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("it");
  if (normalized === "f" || normalized === "favorevole") return 1;
  if (normalized === "c" || normalized === "contrario") return -1;
  if (normalized === "i" || normalized === "indeciso" || normalized === "non lo so") return 0;
  return null;
}

export interface CompassAxisResult {
  score: number | null;          // Conservative qualified score (existing thresholds)
  previewScore: number | null;   // A clearly marked draft after >=1 relevant definite answer
  answered: number;
  undecided: number;
  total: number;
  negativeAnswered: number;
  positiveAnswered: number;
}

export function scoreCompassAxis(
  axis: CompassDimension,
  answers: Record<string, string>,
): CompassAxisResult {
  const items = COMPASS_QUESTIONS.filter((item) => item.axis === axis);
  const negative: number[] = [];
  const positive: number[] = [];
  let undecided = 0;

  for (const item of items) {
    const answer = readCompassAnswer(answers[item.id]);
    if (answer === null) continue;
    if (answer === 0) {
      undecided++;
      continue;
    }
    if (item.direction === -1) negative.push(answer * -1);
    else positive.push(answer);
  }

  const answered = negative.length + positive.length;
  // Gate conservativo: >= 8 risposte nette E almeno 2 per ciascun polo.
  // Un solo voto nel polo meno rappresentato non deve determinare l'asse.
  // Soglia operativa di PROTOTIPO, non stima di attendibilita scientifica.
  const qualified = answered >= 8 && negative.length >= 2 && positive.length >= 2;
  const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length;
  // Pesi uguali ai due gruppi di domande, per evitare che il numero diverso di
  // proposte in ciascun polo sposti artificiosamente il punteggio.
  // A draft uses available evidence only. Never substitute zero for a wholly
  // unanswered pole: that would fabricate an apparent politically neutral vote.
  // Once both groups are represented, use the same balanced weighting as the
  // qualified compass. Preserve the existing gate for the final score.
  const previewScore = answered === 0 ? null : Math.round(
    negative.length && positive.length
      ? 50 * (mean(negative) + mean(positive))
      : 100 * mean(negative.length ? negative : positive),
  );
  const score = qualified ? previewScore : null;

  return {
    score,
    previewScore,
    answered,
    undecided,
    total: items.length,
    negativeAnswered: negative.length,
    positiveAnswered: positive.length,
  };
}

export function calculatePoliticalCompass(answers: Record<string, string>) {
  return {
    economy: scoreCompassAxis("economia", answers),
    freedom: scoreCompassAxis("liberta", answers),
  };
}

// Indicatori tematici separati dal compasso a due dimensioni.
// Mappatura esplorativa: i poli sono convenzioni di lettura, NON identità politiche.
// Una risposta "Non lo so" e l'assenza di risposta non producono il 50%.
export type PoliticalAxisId = "economia" | "stato" | "costumi" | "ambiente" | "immigrazione";
export interface PoliticalAxisDefinition {
  id: PoliticalAxisId;
  title: string;
  leftLabel: string;
  rightLabel: string;
  experimental: boolean;
  minAnswers: number;
  minLeft: number;
  minRight: number;
  // -1: favorevole sostiene il polo sinistro, +1: il polo destro.
  questions: readonly { id: string; direction: CompassDirection }[];
}

export const POLITICAL_AXES: readonly PoliticalAxisDefinition[] = [
  {
    id: "economia", title: "Economia", leftLabel: "Uguaglianza", rightLabel: "Mercato",
    experimental: false, minAnswers: 5, minLeft: 2, minRight: 2,
    questions: [
      { id: "patrimoniale", direction: -1 },
      { id: "salario_minimo", direction: -1 },
      { id: "reddito_di_cittadinanza", direction: -1 },
      { id: "reddito_minimo_regionale", direction: -1 },
      { id: "multe_in_base_al_reddito", direction: -1 },
      { id: "nuove_case_popolari", direction: -1 },
      { id: "settimana_lavorativa_32_ore", direction: -1 },
      { id: "trasporto_pubblico_gratuito", direction: -1 },
      { id: "treni_regionali_gratuiti", direction: -1 },
      { id: "asili_nido_gratuiti", direction: -1 },
      { id: "gare_treni_regionali", direction: 1 },
      { id: "gare_concessioni_balneari", direction: 1 },
      { id: "sanita_privata_convenzionata", direction: 1 },
      { id: "finanziamento_rsa_private", direction: 1 },
      { id: "finanziamento_scuole_paritarie", direction: 1 },
    ],
  },
  {
    id: "stato", title: "Stato", leftLabel: "Libertà", rightLabel: "Autorità",
    experimental: false, minAnswers: 5, minLeft: 2, minRight: 2,
    questions: [
      { id: "eutanasia", direction: -1 },
      { id: "legalizzazione_canapa", direction: -1 },
      { id: "matrimonio_gay", direction: -1 },
      { id: "adozioni_omogenitoriali", direction: -1 },
      { id: "gestazione_per_altri", direction: -1 },
      { id: "aborto_farmacologico_consultori", direction: -1 },
      { id: "case_chiuse", direction: -1 },
      { id: "educazione_sessuale", direction: -1 },
      { id: "videosorveglianza_in_spazi_pubblici", direction: 1 },
      { id: "leva_obbligatoria", direction: 1 },
      { id: "abolizione_contante", direction: 1 },
      { id: "restrizioni_sale_gioco", direction: 1 },
      { id: "limitazioni_movida_notturna", direction: 1 },
      { id: "polizia_locale_armata", direction: 1 },
    ],
  },
  {
    // Il catalogo contiene soprattutto proposte di apertura dei diritti:
    // opposizione a una proposta NON dimostra un'identità "tradizionalista".
    // Da validare con quesiti simmetrici prima di trattarlo come misura generale.
    id: "costumi", title: "Costumi", leftLabel: "Progresso", rightLabel: "Tradizione",
    experimental: true, minAnswers: 4, minLeft: 4, minRight: 0,
    questions: [
      { id: "matrimonio_gay", direction: -1 },
      { id: "adozioni_omogenitoriali", direction: -1 },
      { id: "gestazione_per_altri", direction: -1 },
      { id: "eutanasia", direction: -1 },
      { id: "aborto_farmacologico_consultori", direction: -1 },
      { id: "educazione_sessuale", direction: -1 },
      { id: "omobitransfobia", direction: -1 },
    ],
  },
  {
    // Lato "Crescita" basato su alcune infrastrutture/gestione rifiuti:
    // non è un'opposizione necessaria all'ecologia. Indicatore esplorativo.
    id: "ambiente", title: "Ambiente", leftLabel: "Ecologia", rightLabel: "Crescita",
    experimental: true, minAnswers: 5, minLeft: 3, minRight: 2,
    questions: [
      { id: "auto_emissioni_zero_2035", direction: -1 },
      { id: "potenziare_rinnovabili", direction: -1 },
      { id: "nuovi_parchi_eolici", direction: -1 },
      { id: "nuove_aree_naturali_protette", direction: -1 },
      { id: "nuove_piste_ciclabili", direction: -1 },
      { id: "estensione_delle_zone_a_traffico_limitato", direction: -1 },
      { id: "citta_30", direction: -1 },
      { id: "pedonalizzazione_centro_storico", direction: -1 },
      { id: "menu_vegetali_mense_scolastiche", direction: -1 },
      { id: "nuovi_inceneritori", direction: 1 },
      { id: "nuove_discariche", direction: 1 },
      { id: "ponte_sullo_stretto", direction: 1 },
    ],
  },
  {
    // Solo una proposta nel polo "Controllo" e cittadinanza mescolata
    // all'accoglienza: indispensabili nuove domande prima della validazione.
    id: "immigrazione", title: "Immigrazione",
    leftLabel: "Accoglienza", rightLabel: "Controllo",
    experimental: true, minAnswers: 3, minLeft: 2, minRight: 1,
    questions: [
      { id: "centri_comunali_accoglienza_migranti", direction: -1 },
      { id: "ius_soli", direction: -1 },
      { id: "ius_scholae", direction: -1 },
      { id: "centri_migranti_estero", direction: 1 },
    ],
  },
];

export interface PoliticalAxisResult {
  score: number | null;
  previewScore: number | null;   // draft only, never presented as a validated ideology
  previewLeftPercent: number | null;
  previewRightPercent: number | null;           // -100 (polo sinistro) ... +100 (polo destro)
  leftPercent: number | null;     // solo se superata la soglia, non una prevalenza demografica
  rightPercent: number | null;
  answered: number;
  undecided: number;
  total: number;
  leftAnswered: number;
  rightAnswered: number;
}

export function scorePoliticalAxis(
  axis: PoliticalAxisDefinition,
  answers: Record<string, string>,
): PoliticalAxisResult {
  const left: number[] = [];
  const right: number[] = [];
  let undecided = 0;
  for (const question of axis.questions) {
    const answer = readCompassAnswer(answers[question.id]);
    if (answer === null) continue;
    if (answer === 0) {
      undecided++;
      continue;
    }
    const signed = answer * question.direction;
    if (question.direction === -1) left.push(signed);
    else right.push(signed);
  }
  const answered = left.length + right.length;
  const qualified = answered >= axis.minAnswers &&
    left.length >= axis.minLeft && right.length >= axis.minRight;
  const mean = (numbers: number[]) =>
    numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  // Quando i due poli sono presenti, ciascun gruppo pesa il 50%, anche
  // se il catalogo contiene più domande in uno dei due gruppi.
  // Costumi è esplicitamente monolaterale/sperimentale: usa un solo gruppo.
  // For sparse responses an explicitly provisional estimate is permitted.
  // Do not infer an absent opposite group's preferences as a neutral vote.
  const previewScore = answered === 0 ? null : Math.round(
    left.length && right.length
      ? 50 * (mean(left) + mean(right))
      : 100 * mean(left.length ? left : right),
  );
  const score = qualified ? previewScore : null;
  const previewLeftPercent = previewScore === null ? null : Math.round((100 - previewScore) / 2);
  const leftPercent = score === null ? null : Math.round((100 - score) / 2);
  return {
    score,
    previewScore,
    previewLeftPercent,
    previewRightPercent: previewLeftPercent === null ? null : 100 - previewLeftPercent,
    leftPercent,
    rightPercent: leftPercent === null ? null : 100 - leftPercent,
    answered,
    undecided,
    total: axis.questions.length,
    leftAnswered: left.length,
    rightAnswered: right.length,
  };
}

export function calculatePoliticalAxes(
  answers: Record<string, string>,
): Record<PoliticalAxisId, PoliticalAxisResult> {
  return Object.fromEntries(
    POLITICAL_AXES.map((axis) => [axis.id, scorePoliticalAxis(axis, answers)]),
  ) as Record<PoliticalAxisId, PoliticalAxisResult>;
}
