export interface Referendum {
  id: string;
  nome: string;
  descrizione?: string;
  data_inizio?: string;
  data_fine?: string;
  status?: string;
  quorum?: string;
  esito?: string;
  firestore_id_backup?: string;
  firme?: number;
  emoji?: string;
}

export interface Classifica {
  nome: string;
  voti: number;
  emoji?: string;
}

export interface ReferendumAbrogativiData {
  referendum: Referendum[];
  classifica: Classifica[];
  mieiVoti: string[];
  blocco?: {
    isBlocked: boolean;
  };
}
