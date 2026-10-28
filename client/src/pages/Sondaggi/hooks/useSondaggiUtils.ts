import { PieDataItem } from "../types";

export const useSondaggiUtils = () => {
  // Prepara dati per il grafico a torta del genere
  const prepareGenerePieData = (genereData: any): PieDataItem[] => {
    if (!Array.isArray(genereData)) return [];
    return genereData
      .filter(item => item?.sesso === 'M' || item?.sesso === 'F')
      .map(item => ({
        name: item.sesso === 'M' ? 'Maschile' : 'Femminile',
        value: Math.max(0, Number(item.totale) || 0)
      }))
      .filter(item => item.value > 0);
  };

  // Calcola il totale dei voti
  const calculateTotalVotes = (stats: any): number => {
    if (!stats) return 0;
    
    return Object.values(stats).reduce((total: number, stat: any) => 
      total + (stat.favorevole + stat.contrario + stat.indeciso + stat.astenuto), 0
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
