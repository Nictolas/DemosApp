import { useMemo } from "react";

type OpinionData = { favorevole: number; contrario: number; indeciso: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
interface Question { id: string; text: string; }

// Colori per le risposte
const COLORS = {
  favorevole: '#10B981', // Verde
  contrario: '#EF4444',  // Rosso
  indeciso: '#FCD34D',   // Giallo
  astenuto: '#6B7280'    // Grigio
};

const GENERE_COLORS = ['#3B82F6', '#EC4899', '#FCD34D']; // Blu, Rosa, Giallo

export function useSondaggiCharts(stats: OpinionStats | undefined, questions: Question[]) {
  
  // Prepara dati per il grafico a torta di una singola domanda
  const preparePieData = useMemo(() => (questionKey: string) => {
    if (!stats) return [];
    const questionStats = stats[questionKey];
    
    if (!questionStats) {
      return [];
    }
    
    const favorevole = Math.max(0, Number(questionStats.favorevole) || 0);
    const contrario = Math.max(0, Number(questionStats.contrario) || 0);
    const indeciso = Math.max(0, Number(questionStats.indeciso) || 0);
    const astenuto = Math.max(0, Number(questionStats.astenuto) || 0);
    
    if (favorevole === 0 && contrario === 0 && indeciso === 0 && astenuto === 0) {
      return [];
    }
    
    const data = [];
    if (favorevole > 0) data.push({ name: 'Favorevole', value: favorevole, color: COLORS.favorevole });
    if (contrario > 0) data.push({ name: 'Contrario', value: contrario, color: COLORS.contrario });
    if (indeciso > 0) data.push({ name: 'Indeciso', value: indeciso, color: COLORS.indeciso });
    if (astenuto > 0) data.push({ name: 'Astenuto', value: astenuto, color: COLORS.astenuto });
    
    return data;
  }, [stats]);

  // Prepara dati per il grafico a barre
  const barChartData = useMemo(() => {
    if (!stats || questions.length === 0) return [];
    
    const filteredQuestions = questions.filter(q => q.text && q.text.trim() !== '');
    
    const barData = filteredQuestions.map(q => {
      const questionStats = stats[q.id];
      if (!questionStats) {
        return null;
      }
      
      return {
        name: q.text,
        Favorevole: Math.max(0, Number(questionStats.favorevole) || 0),
        Contrario: Math.max(0, Number(questionStats.contrario) || 0),
        Indeciso: Math.max(0, Number(questionStats.indeciso) || 0),
        Astenuto: Math.max(0, Number(questionStats.astenuto) || 0),
      };
    }).filter(Boolean) as Array<{ 
      name: string; 
      Favorevole: number; 
      Contrario: number; 
      Indeciso: number; 
      Astenuto: number; 
    }>;
    
    return barData;
  }, [stats, questions]);

  // Prepara dati per il grafico a torta del genere
  const prepareGenerePieData = useMemo(() => (genereData: any) => {
    if (!genereData) return [];
    
    return [
      { name: 'Uomo', value: parseInt(genereData.uomo) || 0 },
      { name: 'Donna', value: parseInt(genereData.donna) || 0 },
      { name: 'Altro', value: parseInt(genereData.altro) || 0 },
    ].filter(item => item.value > 0);
  }, []);

  // Calcola statistiche aggregate
  const aggregateStats = useMemo(() => {
    if (!stats) return { totalVotes: 0, totalQuestions: questions.length };
    
    const totalVotes = Object.values(stats).reduce((total, stat) => 
      total + (stat.favorevole + stat.contrario + stat.indeciso + stat.astenuto), 0
    );
    
    return {
      totalVotes,
      totalQuestions: questions.length,
    };
  }, [stats, questions]);

  return {
    COLORS,
    GENERE_COLORS,
    preparePieData,
    barChartData,
    prepareGenerePieData,
    aggregateStats,
  };
}
