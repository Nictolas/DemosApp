/**
 * Pilot of the shared, scannable Opinion brief format.
 * Only these nine canonical IDs opt in; the other 85 use the original
 * server-rendered Markdown unchanged. No new endpoint, SQL or local storage.
 * Dates describe editorial verification, not an automatic legal update.
 */
export interface OpinionBrief {
  intro: string;
  facts: ReadonlyArray<{ value: string; label: string }>;
  comparison: ReadonlyArray<{ label: string; title: string; text: string }>;
  comparisonMode?: "transition";
  legalStatuses?: ReadonlyArray<{
    place: string;
    status: "regulated" | "limited" | "prohibited";
    label: string;
    rule: string;
  }>;
  measuredResultsTitle?: string;
  measuredResults?: ReadonlyArray<{
    place: string;
    topic: string;
    value: string;
    period: string;
    meaning: string;
    sourceUrl: string;
  }>;
  evidenceCaveat?: string;
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
  legalizzazione_canapa: {
    intro: "Legalizzare e regolamentare la cannabis per adulti: produzione, vendita e controlli. Diversa dalla canapa industriale e dall'uso medico.",
    facts: [],
    comparisonMode: "transition",
    comparison: [
      { label: "🇮🇹 Italia oggi", title: "Vendita non legalizzata", text: "La vendita per uso ricreativo è vietata; il possesso personale segue regole differenti." },
      { label: "Modifica proposta", title: "Mercato regolato", text: "Possibile vendita per adulti con licenze, controlli sulla qualità e limiti da definire per legge." },
    ],
    legalStatuses: [
      { place: "🇨🇦 Canada", status: "regulated", label: "Vendita regolata", rule: "Dal 2018, negozi autorizzati e limiti per gli adulti." },
      { place: "🇺🇾 Uruguay", status: "regulated", label: "Accesso regolato", rule: "Farmacie, club e coltivazione registrata; legge del 2013." },
      { place: "🇩🇪 Germania", status: "limited", label: "Legalizzazione parziale", rule: "Dal 2024: possesso e coltivazione limitati; non vendita libera nei negozi." },
      { place: "🇮🇹 Italia", status: "prohibited", label: "Vendita ricreativa vietata", rule: "Non esiste un mercato autorizzato per uso ricreativo." },
    ],
    measuredResults: [
      {
        place: "🇨🇦 Canada",
        topic: "Entrate pubbliche dalla cannabis",
        value: "2,5 mld CAD",
        period: "2024/25 · +11,5% in un anno",
        meaning: "Imposte, ricavi netti delle autorità e altre entrate: non solo tasse e non profitto privato.",
        sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260305/dq260305b-eng.htm",
      },
      {
        place: "🇨🇦 Canada",
        topic: "Consumatori: fonte abituale legale",
        value: "37% → 72%",
        period: "2019 → 2024",
        meaning: "Quota dei consumatori che dichiara di acquistare abitualmente da fonti legali.",
        sourceUrl: "https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/research-data/canadian-cannabis-survey-2024-summary.html",
      },
      {
        place: "🇨🇦 Canada",
        topic: "Consumatori: fonte abituale illegale",
        value: "16% → 3%",
        period: "2019 → 2024",
        meaning: "Acquisti dichiarati presso negozi o rivenditori illegali; non indica tutti i reati.",
        sourceUrl: "https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/research-data/canadian-cannabis-survey-2024-summary.html",
      },
      {
        place: "🇺🇾 Uruguay",
        topic: "Ricorso al narcotraffico tradizionale",
        value: "58,2% → 6,7%",
        period: "2014 → 2024",
        meaning: "Quota di consumatori che segnala il narcotraffico tradizionale come via di accesso: non è il tasso di criminalità.",
        sourceUrl: "https://www.gub.uy/presidencia/comunicacion/noticias/cannabis-iirca-junta-de-drogas-informe",
      },
      {
        place: "🇨🇦 Québec (Canada)",
        topic: "Uso nell'ultimo anno",
        value: "14% → 17%",
        period: "Popolazione totale · 2018 → 2025",
        meaning: "Tra 15 e 20 anni, invece: 28% → 19%. Differenze osservate, non prova causale.",
        sourceUrl: "https://statistique.quebec.ca/en/communique/after-increasing-between-2018-and-2021-cannabis-use-now-on-downward-trend-quebec",
      },
    ],
    evidenceCaveat: "I Paesi usano leggi e misure diverse. I dati descrivono vendite, fonti di acquisto o consumi: non dimostrano un calo della criminalità generale. Per l'Italia non esistono risultati di un mercato ricreativo legale da confrontare.",
    advantage: "Entrate pubbliche, qualità controllata e possibile riduzione del mercato clandestino.",
    concern: "Consumo problematico, guida alterata e persistenza di vendite illegali.",
    note: "Uso ricreativo, terapeutico e canapa industriale sono regimi distinti.",
    sources: [
      { label: "🇮🇹 Italia · DPR 309/1990, Normattiva", url: "https://www.normattiva.it/eli/id/1990/10/31/090G0363/CONSOLIDATED/20260823" },
      { label: "🇨🇦 Canada · Legalizzazione 2018, Health Canada", url: "https://www.canada.ca/en/health-canada/news/2018/10/canada-legalizes-and-strictly-regulates-cannabis.html" },
      { label: "🇨🇦 Canada · Entrate pubbliche 2024/25, Statistics Canada", url: "https://www150.statcan.gc.ca/n1/daily-quotidien/260305/dq260305b-eng.htm" },
      { label: "🇨🇦 Canada · Fonti di acquisto 2019–2024, Health Canada", url: "https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/research-data/canadian-cannabis-survey-2024-summary.html" },
      { label: "🇺🇾 Uruguay · Monitoraggio mercato, Governo", url: "https://www.gub.uy/presidencia/comunicacion/noticias/cannabis-iirca-junta-de-drogas-informe" },
      { label: "🇩🇪 Germania · Legge sulla cannabis, Ministero della salute", url: "https://www.bundesgesundheitsministerium.de/service/gesetze-und-verordnungen/detail/cannabisgesetz" },
      { label: "🇨🇦 Québec · Consumi 2018–2025, Istituto di statistica", url: "https://statistique.quebec.ca/en/communique/after-increasing-between-2018-and-2021-cannabis-use-now-on-downward-trend-quebec" },
    ],
    verified,
  },
  salario_minimo: {
    intro: "Stabilire per legge una paga minima nazionale sotto la quale i datori di lavoro non possono scendere. In Italia oggi prevalgono i contratti collettivi.",
    facts: [],
    comparisonMode: "transition",
    comparison: [
      { label: "🇮🇹 Oggi", title: "Contratti collettivi", text: "Non c'è un minimo salariale unico fissato per legge; le paghe variano per settore." },
      { label: "Modifica proposta", title: "Soglia legale nazionale", text: "Una paga minima obbligatoria per legge, da definire nell'importo e nelle eccezioni." },
    ],
    measuredResultsTitle: "Confronto europeo · luglio 2026",
    measuredResults: [
      {
        place: "🇪🇺 UE",
        topic: "Paesi con un minimo nazionale",
        value: "22 su 27",
        period: "1 luglio 2026",
        meaning: "Gli altri cinque usano sistemi fondati sulla contrattazione collettiva.",
        sourceUrl: "https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/1568.pdf",
      },
      {
        place: "🇱🇺 Lussemburgo",
        topic: "Minimo mensile lordo",
        value: "2.771 €",
        period: "1 luglio 2026",
        meaning: "Importo nazionale lordo: non è la retribuzione netta.",
        sourceUrl: "https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/1568.pdf",
      },
      {
        place: "🇧🇬 Bulgaria",
        topic: "Minimo mensile lordo",
        value: "620 €",
        period: "1 luglio 2026",
        meaning: "Le differenze di prezzo tra Paesi riducono la comparabilità diretta.",
        sourceUrl: "https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/1568.pdf",
      },
    ],
    evidenceCaveat: "Questi sono importi e regole, non prove degli effetti su occupazione o povertà. Il potere d'acquisto e la copertura dei contratti cambiano tra Paesi.",
    advantage: "Può proteggere dalle paghe più basse e rafforzare la trasparenza salariale.",
    concern: "Se mal calibrato può aumentare i costi in settori e imprese a bassa produttività.",
    note: "La direttiva UE sul salario minimo non obbliga l'Italia a introdurre una soglia legale.",
    sources: [
      { label: "Eurostat · Salari minimi, luglio 2026", url: "https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/1568.pdf" },
      { label: "Eurostat · Serie dati sui salari minimi", url: "https://ec.europa.eu/eurostat/databrowser/product/view/earn_mw_cur" },
      { label: "Commissione UE · Cosa prevede la direttiva 2022/2041", url: "https://employment-social-affairs.ec.europa.eu/policies-and-activities/rights-work/labour-law/working-conditions/adequate-minimum-wages-eu/questions-answers-adequate-minimum-wages-eu_en" },
    ],
    verified,
  },
  citta_30: {
    intro: "Estendere il limite di 30 km/h nelle strade cittadine, con eccezioni per alcune arterie. L'obiettivo è ridurre la gravità degli incidenti.",
    facts: [],
    comparison: [
      { label: "Regole esistenti", title: "Limiti differenziati", text: "In molte strade urbane vale 50 km/h; il 30 è già previsto in alcune zone." },
      { label: "Modello Città 30", title: "30 km/h diffuso", text: "Limite più basso su molte strade, con eccezioni, segnaletica e controlli." },
    ],
    measuredResultsTitle: "Bologna · prima e dopo",
    measuredResults: [
      {
        place: "🇮🇹 Bologna",
        topic: "Incidenti rilevati",
        value: "−12,5%",
        period: "2022–23 → 2024–25",
        meaning: "Da 5.653 a 4.944 incidenti nei due bienni.",
        sourceUrl: "https://www.comune.bologna.it/novita/comunicati-stampa/bologna-citta-30-il-report-del-2025",
      },
      {
        place: "🇮🇹 Bologna",
        topic: "Persone decedute",
        value: "−43,6%",
        period: "2022–23 → 2024–25",
        meaning: "Da 39 a 22 vittime sulle strade considerate.",
        sourceUrl: "https://www.comune.bologna.it/novita/comunicati-stampa/bologna-citta-30-il-report-del-2025",
      },
      {
        place: "🇮🇹 Bologna",
        topic: "Persone ferite",
        value: "−7,2%",
        period: "2022–23 → 2024–25",
        meaning: "Da 4.848 a 4.500 feriti nei due bienni.",
        sourceUrl: "https://www.comune.bologna.it/novita/comunicati-stampa/bologna-citta-30-il-report-del-2025",
      },
    ],
    evidenceCaveat: "Confronti temporali dai dati della Polizia Locale pubblicati dal Comune: non isolano l'effetto del limite di velocità da altri interventi o cambiamenti nel traffico. Le strade considerate escludono autostrade e tangenziale.",
    advantage: "Può ridurre gravità e frequenza degli scontri, soprattutto per gli utenti vulnerabili.",
    concern: "Possibili tempi di viaggio maggiori su alcune tratte e costi di adeguamento e controllo.",
    note: "Città 30 non significa che ogni strada abbia lo stesso limite: sono previste eccezioni.",
    sources: [
      { label: "Comune di Bologna · Report 2025 (27 gennaio 2026)", url: "https://www.comune.bologna.it/novita/comunicati-stampa/bologna-citta-30-il-report-del-2025" },
      { label: "Città metropolitana di Bologna · Dati incidenti 2025", url: "https://www.cittametropolitana.bo.it/statistica/Home/incidentalita_stradale_citta_metropolitana_comuni_2025" },
    ],
    verified,
  },
  auto_emissioni_zero_2035: {
    intro: "Regole europee sulle emissioni di CO₂ delle auto nuove dal 2035. Non è un divieto di usare le automobili già acquistate.",
    facts: [],
    comparisonMode: "transition",
    comparison: [
      { label: "🇪🇺 Norma vigente", title: "Obiettivo 100%", text: "Riduzione del 100% della CO₂ allo scarico per le nuove auto e i furgoni dal 2035." },
      { label: "Revisione proposta", title: "Obiettivo 90%", text: "La Commissione ha proposto nel 2025 maggiore flessibilità, con compensazioni per il restante 10%." },
    ],
    measuredResultsTitle: "Mercato UE · dati osservati",
    measuredResults: [
      {
        place: "🇪🇺 Unione europea",
        topic: "CO₂ media delle auto nuove",
        value: "−28%",
        period: "2019 → 2024",
        meaning: "Riduzione della media delle emissioni dei veicoli di nuova immatricolazione.",
        sourceUrl: "https://climate.ec.europa.eu/areas-action/transport-decarbonisation/road-transport/cars-and-vans_en",
      },
      {
        place: "🇪🇺 UE + Norvegia e Islanda",
        topic: "Auto nuove a zero emissioni",
        value: "14,5%",
        period: "2024",
        meaning: "Quota delle nuove immatricolazioni nella popolazione geografica dichiarata dalla Commissione.",
        sourceUrl: "https://climate.ec.europa.eu/areas-action/transport-decarbonisation/road-transport/cars-and-vans_en",
      },
    ],
    evidenceCaveat: "La riduzione osservata precede il 2035 e non misura l'effetto futuro delle norme. La quota 14,5% comprende anche Norvegia e Islanda. La revisione al 90% è una proposta, non la regola vigente.",
    advantage: "Stimola auto con minori emissioni dirette e investimenti in tecnologie alternative.",
    concern: "Prezzi d'acquisto, rete di ricarica e investimenti necessari per la filiera produttiva.",
    note: "L'obiettivo è per le nuove auto, non per tutte quelle già in circolazione.",
    sources: [
      { label: "Commissione UE · Cars and vans, regole e risultati", url: "https://climate.ec.europa.eu/areas-action/transport-decarbonisation/road-transport/cars-and-vans_en" },
      { label: "Commissione UE · Automotive Package, dicembre 2025", url: "https://transport.ec.europa.eu/transport-themes/action-plan-future-automotive-sector/automotive-package_en" },
      { label: "EUR-Lex · Regolamento (UE) 2023/851", url: "https://eur-lex.europa.eu/eli/reg/2023/851/oj" },
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
