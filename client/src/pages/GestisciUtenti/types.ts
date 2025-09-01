export type User = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: 'pending' | 'active' | 'rejected';
  // Aggiungo tutte le altre colonne possibili
  [key: string]: any; // Per permettere colonne dinamiche
};

export type UsersResponse = {
  utenti: User[];
  pendingUsers: User[];
};

export type SortField = keyof User;
export type SortDirection = "asc" | "desc";

export type ApprovalAction = {
  userId: string;
  approve: boolean;
};

export type UserAction = 'edit' | 'opinions' | 'delete';

export type FilterType = 
  | 'candidato:attivo' 
  | 'elezione:comune' 
  | 'elezione:regionale' 
  | 'elezione:nazionale' 
  | string;
