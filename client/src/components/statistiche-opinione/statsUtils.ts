import { StatsData, GenereData, EtaData, PieChartData, BarChartData } from "./types";

// Costanti per i colori
export const COLORS = ['#10B981', '#EF4444', '#FCD34D', '#6B7280']; // Favorevole, Contrario, Indeciso, Astenuto
export const GENERE_COLORS = ['#3B82F6', '#EC4899', '#FCD34D']; // Uomo, Donna, Altro

// Mappa delle regioni italiane
export const REGIONI = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 
  'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'
];

// Calcola il totale dei voti
export const calculateTotalVotes = (stats: StatsData): number => {
  return parseInt(stats.favorevole) + parseInt(stats.contrario) + parseInt(stats.indeciso) + parseInt(stats.astenuto);
};

// Prepara i dati per il grafico a torta
export const preparePieData = (stats: StatsData): PieChartData[] => {
  const data = [
    { name: 'Favorevole', value: parseInt(stats.favorevole) || 0 },
    { name: 'Contrario', value: parseInt(stats.contrario) || 0 },
    { name: 'Indeciso', value: parseInt(stats.indeciso) || 0 },
    { name: 'Astenuto', value: parseInt(stats.astenuto) || 0 }
  ];
  
  return data.filter(item => item.value > 0);
};

// Prepara i dati per il grafico a barre del genere
export const prepareGenereBarData = (genereData: GenereData[]): BarChartData[] => {
  return genereData?.map(item => ({
    name: item.fascia_eta,
    uomo: parseInt(item.favorevole) || 0,
    donna: parseInt(item.contrario) || 0,
    altro: parseInt(item.indeciso) || 0,
  })) || [];
};

// Prepara i dati per il grafico a barre dell'età
export const prepareEtaBarData = (etaData: EtaData[]): BarChartData[] => {
  return etaData?.map(item => ({
    name: item.fascia_eta,
    Favorevole: parseInt(item.favorevole) || 0,
    Indeciso: parseInt(item.indeciso) || 0,
    Contrario: parseInt(item.contrario) || 0,
    Astenuto: parseInt(item.astenuto) || 0,
  })) || [];
};

// Prepara i dati per il grafico a torta del genere
export const prepareGenerePieData = (genereData: GenereData[]): PieChartData[] => {
  if (!genereData || genereData.length === 0) return [];
  
  const totali = genereData.reduce((acc, item) => {
    acc.favorevole += parseInt(item.favorevole) || 0;
    acc.contrario += parseInt(item.contrario) || 0;
    acc.indeciso += parseInt(item.indeciso) || 0;
    return acc;
  }, { favorevole: 0, contrario: 0, indeciso: 0 });
  
  return [
    { name: 'Uomo', value: totali.favorevole },
    { name: 'Donna', value: totali.contrario },
    { name: 'Altro', value: totali.indeciso }
  ].filter(item => item.value > 0);
};

// Estrai l'ID dell'opinione dall'URL
export const extractOpinionId = (): string => {
  const pathParts = window.location.pathname.split('/');
  let opinionId = pathParts[pathParts.length - 1];
  
  // Se siamo in una pagina regionale, l'opinionId è prima di "regione"
  if (pathParts.includes('regione')) {
    const regioneIndex = pathParts.indexOf('regione');
    opinionId = pathParts[regioneIndex - 1];
  }
  
  return opinionId;
};

// Controlla se siamo in una pagina regionale
export const isRegionalPage = (): boolean => {
  const pathParts = window.location.pathname.split('/');
  return pathParts.includes('regione') && pathParts.length > 3;
};

// Ottieni la regione dall'URL
export const getRegionFromUrl = (): string | null => {
  const pathParts = window.location.pathname.split('/');
  if (pathParts.includes('regione') && pathParts.length > 3) {
    const regioneIndex = pathParts.indexOf('regione');
    return pathParts[regioneIndex + 1];
  }
  return null;
};
