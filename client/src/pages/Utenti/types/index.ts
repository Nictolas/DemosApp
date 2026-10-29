import { UserSummary } from "@/types/profile";

export type User = UserSummary;

export type SortDirection = "asc" | "desc";

export interface UsersResponse {
  utenti: User[];
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
