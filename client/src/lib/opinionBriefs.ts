/**
 * Pilot of the shared, scannable Opinion brief format.
 * Only these five canonical IDs opt in; the other 89 use the original
 * server-rendered Markdown unchanged. No new endpoint, SQL or local storage.
 * Dates describe editorial verification, not an automatic legal update.
 */
export interface OpinionBrief {
  intro: string;
  facts: ReadonlyArray<{ value: string; label: string }>;
  comparison: ReadonlyArray<{ label: string; title: string; text: string }>;
  comparisonMode?: "transition";
  advantage: string;
  concern: string;
  note?: string;
  sources: ReadonlyArray<{ label: string; url: string }>;
  verified: string;
}

const verified = "31/10/2026";

export const OPINION_BRIEFS: Readonly<Record<string, OpinionBrief>> = {
  fuochi_d_artificio: {
    intro: "Consentire, limitare o vietare i fuochi d’artificio, soprattutto i botti rumorosi.",
    facts: [
      { value: "F1", label: "Unica categoria acquistabile dal pubblico in Irlanda" },
      { value: "2010", label: "Dal 4 luglio, F1 in vendita in Irlanda" },
      { value: "2232/2025", label: "Sentenza sui limiti ai divieti comunali" },
    ],
    comparison: [
      { label: "Regole restrittive", title: "🇮🇪 Irlanda", text: "Ai privati solo F1; altre categorie riservate a spettacoli professionali." },
      { label: "Uso regolamentato", title: "🇮🇹 Italia", text: "Norme nazionali; niente divieti comunali generalizzati tramite semplice regolamento." },
    ],
    advantage: "Tradizioni e spettacoli collettivi organizzati.",
    concern: "Ferimenti, incendi, rumore e stress animale.",
    note: "Non è un nuovo divieto irlandese del 2026.",
    sources: [
      { label: "Governo irlandese · Fuochi d'artificio", url: "https://www.gov.ie/en/department-of-justice-home-affairs-and-migration/publications/fireworks/" },
      { label: "Consiglio di Stato · Sentenza 2232/2025", url: "https://www.giustizia-amministrativa.it/en/-/105486-871" },
      { label: "UE · Direttiva 2013/29", url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32013L0029" },
    ],
    verified,
  },
  abolizione_contante: {
    intro: "Eliminare banconote e monete dai pagamenti: si potrebbe pagare solo con strumenti digitali.",
    // Irrelevant and cryptic numbers are omitted on purpose.
    facts: [],
    comparisonMode: "transition",
    comparison: [
      { label: "Situazione attuale", title: "🇪🇺 Contanti e digitale", text: "Banconote e monete in euro hanno corso legale: in generale devono essere accettate, salvo eccezioni." },
      { label: "Modifica proposta", title: "Solo digitale", text: "Niente pagamenti con banconote o monete; soltanto carte, bonifici e app." },
    ],
    advantage: "Maggiore tracciabilità e meno denaro fisico da custodire.",
    concern: "Meno privacy e difficoltà per chi non usa strumenti digitali.",
    note: "Limitare l'importo dei pagamenti in contanti non significa abolirli.",
    sources: [
      { label: "BCE · Il contante è mezzo di pagamento legale", url: "https://www.ecb.europa.eu/euro/cash_strategy/acceptance-cash/html/index.en.html" },
      { label: "Commissione UE · Cosa ha stabilito la Corte nel 2021", url: "https://finance.ec.europa.eu/digital-finance/digital-euro/frequently-asked-questions-digital-euro-and-legal-tender-cash_en" },
    ],
    verified,
  },
  eutanasia: {
    intro: "Provocare intenzionalmente la morte su richiesta del paziente; diversa dal suicidio assistito.",
    facts: [
      { value: "242/2019", label: "Sentenza della Corte costituzionale" },
      { value: "148/2026", label: "Nuova pronuncia sul suicidio assistito" },
    ],
    comparison: [
      { label: "Non legalizzata", title: "🇮🇹 Eutanasia attiva", text: "Non esiste una legalizzazione generale in Italia." },
      { label: "Solo in casi specifici", title: "Suicidio assistito", text: "Non punibile nei casi e con le garanzie definite dalla Consulta." },
    ],
    advantage: "Autodeterminazione e possibilità di evitare sofferenze intollerabili.",
    concern: "Tutelare persone vulnerabili e prevenire pressioni o abusi.",
    note: "Rinuncia alle cure, suicidio assistito ed eutanasia non coincidono.",
    sources: [
      { label: "Corte costituzionale · Sentenza 242/2019", url: "https://www.cortecostituzionale.it/scheda-pronuncia/2019/242" },
      { label: "Corte costituzionale · Sentenza 148/2026", url: "https://www.cortecostituzionale.it/scheda-pronuncia/2026/148" },
    ],
    verified,
  },
  energia_nucleare: {
    intro: "Produrre elettricità con la fissione nucleare, distinta dalla fusione sperimentale.",
    facts: [
      { value: "≈9.000 $/kW", label: "IEA 2022: costo di capitale di primi progetti, esclusi finanziamenti" },
      { value: "2030", label: "Obiettivo IEA: ≈5.000 $/kW nelle economie avanzate" },
    ],
    comparison: [
      { label: "Tecnologia industriale", title: "Fissione", text: "Produzione elettrica programmabile a basse emissioni." },
      { label: "Tecnologia distinta", title: "Fusione", text: "Non è il processo delle centrali oggi in esercizio." },
    ],
    advantage: "Produzione continua e basse emissioni di CO₂ durante l'esercizio.",
    concern: "Costi iniziali, ritardi e gestione delle scorie radioattive.",
    note: "Le cifre IEA sono stime e obiettivi del 2022, non prezzi attuali italiani.",
    sources: [
      { label: "IEA · Nuclear Power and Secure Energy Transitions (2022)", url: "https://www.iea.org/reports/nuclear-power-and-secure-energy-transitions/executive-summary" },
    ],
    verified,
  },
  caccia: {
    intro: "Consentire, limitare o abolire l'attività venatoria, distinta dal controllo faunistico.",
    facts: [
      { value: "157/1992", label: "Legge nazionale sulla tutela della fauna e la caccia" },
      { value: "Regioni", label: "Competenze su calendari e disciplina territoriale" },
    ],
    comparison: [
      { label: "Consentita con regole", title: "🇮🇹 Caccia", text: "Licenze, specie e periodi previsti dalla normativa." },
      { label: "Illegale", title: "Bracconaggio", text: "Abbattimenti e pratiche fuori dalle regole." },
    ],
    advantage: "Tradizione ricreativa e, in alcuni casi regolati, gestione faunistica.",
    concern: "Sofferenza animale, incidenti e rischi per la biodiversità.",
    note: "Il controllo faunistico straordinario non coincide con la caccia ricreativa.",
    sources: [
      { label: "Normattiva · Legge 157/1992", url: "https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=092G0211&atto.dataPubblicazioneGazzetta=1992-02-25&bloccoAggiornamentoBreadCrumb=true&classica=true&dataVigenza=&generaTabId=true&qId=&tabID=&tipoDettaglio=originario&title=lbl.dettaglioAtto" },
    ],
    verified,
  },
};

export function getOpinionBrief(id?: string): OpinionBrief | undefined {
  if (!id) return undefined;
  return Object.prototype.hasOwnProperty.call(OPINION_BRIEFS, id)
    ? OPINION_BRIEFS[id]
    : undefined;
}
