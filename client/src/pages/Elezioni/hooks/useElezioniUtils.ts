import { Elezione, Categoria } from "../types";

export const useElezioniUtils = () => {
  const getElectionForCategory = (elezioni: Elezione[], categoria: Categoria) => {
    return elezioni.find(elezione => elezione.tipo === categoria.tipoElezione);
  };

  const formatElectionDates = (elezione: Elezione | undefined) => {
    if (!elezione) return null;
    if (elezione.circa) return elezione.dataInizio === elezione.dataFine ? `${elezione.dataInizio}` : `${elezione.dataInizio} - ${elezione.dataFine}`;
    
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('it-IT');
    const dataInizio = formatDate(elezione.dataInizio);
    const dataFine = formatDate(elezione.dataFine);
    
    return dataInizio === dataFine ? dataInizio : `${dataInizio} - ${dataFine}`;
  };

  return {
    getElectionForCategory,
    formatElectionDates
  };
};
