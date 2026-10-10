import { PieDataItem } from "../types";

export const useSondaggiUtils = () => {
  // Prepara dati per il grafico a torta del genere
  const prepareGenerePieData = (genereData: any): PieDataItem[] => {
    if (!genereData) return [];
    
    return [
      { name: 'Uomo', value: parseInt(genereData.uomo) || 0 },
      { name: 'Donna', value: parseInt(genereData.donna) || 0 },
      { name: 'Altro', value: parseInt(genereData.altro) || 0 },
    ].filter(item => item.value > 0);
  };

  // Calcola il totale dei voti
  const calculateTotalVotes = (stats: any): number => {
    if (!stats) return 0;
    
    return Object.values(stats).reduce((total: number, stat: any) => 
      total + (stat.favorevole + stat.contrario + stat.indeciso), 0
    );
  };

  // Converte nome regione in slug per URL
  const regionToSlug = (regione: string): string => {
    return regione.toLowerCase().replace(/\s+/g, '-');
  };

  return {
    prepareGenerePieData,
    calculateTotalVotes,
    regionToSlug
  };
};
