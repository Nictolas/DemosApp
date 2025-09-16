export type User = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: "Admin" | "Politico" | "Candidato Politico" | "Istituzione" | "Cittadino" | "Rappresentante";
  status: 'pending' | 'active' | 'rejected';
  // Aggiungo tutte le altre colonne possibili
  [key: string]: any; // Per permettere colonne dinamiche
};

export type SortDirection = "asc" | "desc";

export interface UserTableProps {
  users: User[];
  displayColumns: string[];
  onEditUser: (user: User) => void;
  onEditOpinioni: (user: User) => void;
  onDeleteUser: (user: User) => void;
  sortField: keyof User;
  sortDirection: SortDirection;
  onSort: (field: keyof User) => void;
}

export interface UserSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  lastUpdateTime: Date;
  isLoading: boolean;
}

export interface UserPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
