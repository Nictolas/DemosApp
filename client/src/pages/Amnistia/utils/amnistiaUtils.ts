import { Classifica } from '../types';

// Le regole più specifiche precedono quelle generiche per evitare corrispondenze fuorvianti.
// Niente sottostringhe come "art", "pena", "reato": ricorrono in titoli molto diversi.
const emojiReato: ReadonlyArray<readonly [RegExp, string]> = [
  [/cannabis|marijuana|canapa|hashish|ganja/u, '🌿'],
  [/legittima difesa/u, '🛡️'],
  [/resistenza a pubblico ufficiale/u, '🚓'],
  [/violenza o minaccia a pubblico ufficiale|minaccia a pubblico ufficiale/u, '🗣️'],
  [/rissa|percosse|aggressione|lesioni personali/u, '🥊'],
  [/furto|rapina|borseggio|scippo/u, '👜'],
  [/truffa|frode|raggiro/u, '🎭'],
  [/ricettazione/u, '📦'],
  [/falsa testimonianza|testimonianza|falso giuramento/u, '🗣️'],
  [/domicilio|violazione di abitazione/u, '🏠'],
  [/blocco stradale|sciopero|manifestazion|protesta/u, '🚧'],
  [/diffamazion|stampa|giornal/u, '📰'],
  [/atti osceni|oscenita/u, '🚫'],
  [/abuso d.ufficio|peculato|corruzion|concussion/u, '🏛️'],
  [/evasione fiscale|imposte|tribut|fiscale|tassazion/u, '🧾'],
  [/riciclaggio|denaro illecito/u, '💸'],
  [/falsificazion|contraffazion/u, '🪪'],
  [/informatic|accesso abusivo|cyber|privacy|dati personali/u, '🔐'],
  [/ambiente|inquinament|rifiuti tossici|disboscament/u, '🌍'],
  [/arma|armi|esplosiv/u, '🚨'],
  [/stupefacen|droga|spaccio|psicotrop|tossicodipenden/u, '💊'],
  [/maltrattament|violenza domestic/u, '🚨'],
  [/danneggiament|vandalismo|imbrattament/u, '🧱'],
  [/guida|circolazione stradale|incidente stradale|omicidio stradale/u, '🚗'],
  [/immigrazion|permesso di soggiorno|frontiera/u, '🛂'],
  [/carcere|detenzion|prigione/u, '🔒'],
  [/multa|ammenda|sanzione amministrativa/u, '💶'],
  [/coltivazion/u, '🌱'],
  [/commercio|vendita/u, '🛒'],
  [/produzion/u, '🏭'],
  [/omicidio|uccisione/u, '🕯️'],
];

export const getLeggeEmoji = (legge: string): string => {
  const testo = legge.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return emojiReato.find(([pattern]) => pattern.test(testo))?.[1] ?? '⚖️';
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
