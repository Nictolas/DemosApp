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
// direction -1: intervento pubblico (economia) / maggiori restrizioni (liberta).
// direction +1: ruolo del mercato (economia) / maggiori liberta (liberta).
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
  score: number | null;
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
  // Gate: campione minimo E almeno una posizione espressa per ciascun polo.
  // In assenza di un polo, il grafico non deve inventare la coordinata.
  const qualified = answered >= 5 && negative.length > 0 && positive.length > 0;
  const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length;
  // Pesi uguali ai due gruppi di domande, per evitare che il numero diverso di
  // proposte in ciascun polo sposti artificiosamente il punteggio.
  const score = qualified
    ? Math.round(50 * (mean(negative) + mean(positive)))
    : null;

  return {
    score,
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
