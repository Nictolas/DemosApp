export interface Classifica {
  nome: string;
  voti: number;
}

export interface CapoStatoData {
  classifica: Classifica[];
  mieiVoti: string[];
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}
