// Kept in the client bundle: rendering or changing category never reads Supabase.
export const SUBJECT_PROPOSAL_CATEGORIES = [
  {
    value: "capo_stato",
    label: "Presidente della Repubblica",
    nameLabel: "Nome della persona",
    placeholder: "Nome e cognome",
    sourceLabel: "Fonte pubblica HTTPS",
    explanation: "Proponi un possibile candidato. La candidatura non sarà pubblicata prima della verifica amministrativa.",
    backPath: "/capo-stato",
  },
  {
    value: "grazia",
    label: "Grazia",
    nameLabel: "Nome della persona",
    placeholder: "Nome e cognome",
    sourceLabel: "Fonte pubblica HTTPS",
    explanation: "Non inserire sentenze, reati, dati sanitari, fotografie o dettagli personali. La valutazione richiede cautele specifiche per i dati giudiziari.",
    backPath: "/grazia",
  },
  {
    value: "amnistia",
    label: "Amnistia",
    nameLabel: "Legge o reato proposto",
    placeholder: "Indica la disposizione o il reato",
    sourceLabel: "Fonte normativa pubblica HTTPS",
    explanation: "Indica una norma o fonte istituzionale. La proposta non viene inserita automaticamente nel catalogo.",
    backPath: "/amnistia",
  },
  {
    value: "attivisti",
    label: "Attivista",
    nameLabel: "Nome della persona",
    placeholder: "Nome e cognome",
    sourceLabel: "Fonte pubblica HTTPS",
    explanation: "Segnalare un attivista non crea un profilo utente né certifica la sua identità.",
    backPath: "/attivisti",
  },
  {
    value: "organizzazioni",
    label: "Organizzazione",
    nameLabel: "Nome dell'organizzazione",
    placeholder: "Nome pubblico dell'organizzazione",
    sourceLabel: "Sito o fonte pubblica HTTPS",
    explanation: "Segnalare un'organizzazione non equivale a registrare un account in suo nome.",
    backPath: "/organizzazioni",
  },
] as const;

export type ProposalCategory = (typeof SUBJECT_PROPOSAL_CATEGORIES)[number]["value"];
export const DEFAULT_SUBJECT_CATEGORY: ProposalCategory = "capo_stato";

export function isProposalCategory(value: string | null | undefined): value is ProposalCategory {
  return SUBJECT_PROPOSAL_CATEGORIES.some(item => item.value === value);
}

export function categoryFromSearch(search: string): ProposalCategory {
  const requested = new URLSearchParams(search.startsWith("?") ? search : "?" + search).get("categoria");
  return isProposalCategory(requested) ? requested : DEFAULT_SUBJECT_CATEGORY;
}

export function getProposalCategory(category: ProposalCategory) {
  return SUBJECT_PROPOSAL_CATEGORIES.find(item => item.value === category)!;
}
