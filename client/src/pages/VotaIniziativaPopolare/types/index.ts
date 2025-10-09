export interface Iniziativa {
  id: string;
  nome: string;
  descrizione?: string;
  sitoWeb?: string;
  quorum: string;
  firme?: number;
  dataInizio?: string;
  dataFine?: string;
}

export interface Classifica {
  nome: string;
  sitoWeb?: string;
  voti: number;
}

export interface IniziativePopolariData {
  iniziative: Iniziativa[];
  classifica: Classifica[];
  mieiVoti: string[];
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}
