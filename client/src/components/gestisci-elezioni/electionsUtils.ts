import { Elezione } from "./types";

// Stili personalizzati per line-clamp
export const lineClampStyles = {
  lineClamp2: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
};

// Formatta la data per la visualizzazione
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Calcola le statistiche delle elezioni
export const calculateElectionStats = (elezioni: Elezione[]) => {
  return {
    total: elezioni.length,
    sovranazione: elezioni.filter(e => e.tipo === 'sovranazione').length,
    stato: elezioni.filter(e => e.tipo === 'stato').length,
    regione: elezioni.filter(e => e.tipo === 'regione').length,
    provincia: elezioni.filter(e => e.tipo === 'provincia').length,
    comune: elezioni.filter(e => e.tipo === 'comune').length
  };
};

// Ottieni il colore per tipo di elezione
export const getElectionTypeColor = (tipo: string): string => {
  const colors = {
    sovranazione: 'from-green-50 to-green-100 border-green-200',
    stato: 'from-purple-50 to-purple-100 border-purple-200',
    regione: 'from-orange-50 to-orange-100 border-orange-200',
    provincia: 'from-red-50 to-red-100 border-red-200',
    comune: 'from-blue-50 to-blue-100 border-blue-200'
  };
  return colors[tipo as keyof typeof colors] || colors.comune;
};

// Ottieni l'icona per tipo di elezione
export const getElectionTypeIcon = (tipo: string): string => {
  const icons = {
    sovranazione: '🏛️',
    stato: '🎯',
    regione: '👥',
    provincia: '🏘️',
    comune: '🏠'
  };
  return icons[tipo as keyof typeof icons] || '🗳️';
};

// Valida le date dell'elezione
export const validateElectionDates = (datainizio: string, datafine: string): boolean => {
  const startYear = parseInt(datainizio);
  const endYear = parseInt(datafine);
  
  if (isNaN(startYear) || isNaN(endYear)) return false;
  if (startYear < 2020 || startYear > 2050) return false;
  if (endYear < 2020 || endYear > 2050) return false;
  if (startYear > endYear) return false;
  
  return true;
};

// Prepara i dati per l'API
export const prepareElectionData = (data: any): Partial<Elezione> => {
  return {
    tipo: data.tipo,
    zona: data.zona,
    datainizio: data.datainizio,
    datafine: data.datafine,
    circa: data.circa
  };
};
