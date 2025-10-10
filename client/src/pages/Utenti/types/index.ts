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

export type SortDirection = "asc" | "desc";

export interface UsersResponse {
  utenti: User[];
  pendingUsers: User[];
}

export interface PaginationState {
  currentPage: number;
  usersPerPage: number;
  totalPages: number;
}

export interface SortState {
  sortField: keyof User;
  sortDirection: SortDirection;
}
