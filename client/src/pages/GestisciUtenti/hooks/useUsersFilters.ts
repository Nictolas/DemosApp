import { useState, useMemo } from 'react';
import { User, SortField, SortDirection, FilterType } from '../types';
import { getDisplayColumns, filterAndSortUsers } from '../utils';
import { USERS_PER_PAGE } from '../constants';

export const useUsersFilters = (users: User[]) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>('nome_completo');
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Ottieni le colonne da mostrare
  const displayColumns = getDisplayColumns(users);

  // Filtra e ordina gli utenti
  const filteredAndSortedUsers = useMemo(() => {
    return filterAndSortUsers(users, searchTerm, sortField, sortDirection, displayColumns);
  }, [users, searchTerm, sortField, sortDirection, displayColumns]);

  // Calcola la paginazione
  const totalPages = Math.ceil(filteredAndSortedUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE, 
    currentPage * USERS_PER_PAGE
  );

  // Funzione per gestire l'ordinamento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Funzione per impostare un filtro rapido
  const setQuickFilter = (filter: FilterType) => {
    setSearchTerm(searchTerm === filter ? '' : filter);
    setCurrentPage(1); // Reset alla prima pagina
  };

  // Funzione per resettare i filtri
  const resetFilters = () => {
    setSearchTerm("");
    setSortField('nome_completo');
    setSortDirection("asc");
    setCurrentPage(1);
  };

  return {
    // Stato
    searchTerm,
    sortField,
    sortDirection,
    currentPage,
    displayColumns,
    
    // Dati elaborati
    filteredAndSortedUsers,
    paginatedUsers,
    totalPages,
    
    // Azioni
    setSearchTerm,
    handleSort,
    setQuickFilter,
    resetFilters,
    setCurrentPage
  };
};
