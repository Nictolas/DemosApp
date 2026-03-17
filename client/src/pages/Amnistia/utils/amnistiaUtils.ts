import { Classifica } from '../types';

// Funzione per ottenere l'emoji per una legge
export const getLeggeEmoji = (legge: string): string => {
  const leggeLower = legge.toLowerCase();
  
  // Mappa di parole chiave a emoji
  const emojiMap: { [key: string]: string } = {
    'cannabis': '🌿',
    'marijuana': '🌿',
    'droga': '💊',
    'stupefacenti': '💊',
    'reato': '⚖️',
    'penale': '⚖️',
    'carcere': '🔒',
    'detenzione': '🔒',
    'prigione': '🔒',
    'condanna': '📜',
    'sentenza': '📜',
    'giustizia': '⚖️',
    'legge': '📋',
    'decreto': '📋',
    'codice': '📚',
    'art': '📄',
    'articolo': '📄',
    'amnistia': '🕊️',
    'indulto': '🕊️',
    'grazia': '🕊️',
    'libertà': '🕊️',
    'diritto': '⚖️',
    'cittadino': '👤',
    'persona': '👤',
    'sanzione': '⚠️',
    'multa': '💰',
    'pena': '⚖️',
    'tribunale': '⚖️',
    'corte': '⚖️',
    'processo': '⚖️',
    'crimine': '🚨',
    'delitto': '🚨',
    'violazione': '⚠️',
    'infrazione': '⚠️',
    'sostanza': '💊',
    'psicotropo': '💊',
    'tossicodipendenza': '💊',
    'spaccio': '💊',
    'traffico': '💊',
    'possesso': '📦',
    'consumo': '🍃',
    'coltivazione': '🌱',
    'produzione': '🏭',
    'commercio': '💼',
    'vendita': '💰',
    'acquisto': '🛒',
    'uso': '💉',
    'somministrazione': '💉',
    'somministrare': '💉',
    'somministrato': '💉',
  };
  
  // Cerca corrispondenze nelle parole chiave
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    if (leggeLower.includes(keyword)) {
      return emoji;
    }
  }
  
  // Emoji di default basata sulla prima lettera o categoria
  if (leggeLower.includes('legge') || leggeLower.includes('decreto') || leggeLower.includes('codice')) {
    return '📋';
  }
  if (leggeLower.includes('art') || leggeLower.includes('articolo')) {
    return '📄';
  }
  
  // Emoji di default
  return '⚖️';
};

export const getSuggestions = (classifica: Classifica[], leggeInput: string, showSuggestions: boolean): Classifica[] => {
  if (!leggeInput.trim() || !showSuggestions) return [];
  return classifica
    .filter(item => 
      item.legge.toLowerCase().includes(leggeInput.toLowerCase()) && 
      item.legge.toLowerCase() !== leggeInput.toLowerCase()
    )
    .slice(0, 5);
};


export const isTopThree = (index: number): boolean => {
  return index < 3;
};

export const getLeggeStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "bg-white border-gray-200 hover:bg-gray-50";
  }
  return "bg-white border-gray-200 hover:bg-gray-50";
};

export const getLeggeNumberStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700";
  }
  return "bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700";
};

export const getLeggeTextStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "group-hover:text-yellow-800";
  }
  return "group-hover:text-indigo-800";
};

export const getTrophyColor = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "text-yellow-500";
  }
  return "text-blue-500";
};

export const getButtonStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700";
  }
  return "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700";
};
