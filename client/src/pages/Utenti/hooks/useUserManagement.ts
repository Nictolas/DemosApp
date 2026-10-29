import { useState, useEffect } from "react";
import { User, SortState, PaginationState } from "../types";
import { USERS_PER_PAGE } from "../constants";

export const useUserManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRuolo, setSelectedRuolo] = useState<string>("all");
  const [selectedGradoElezione, setSelectedGradoElezione] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof User>('nome_completo');
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  const sortState: SortState = { sortField, sortDirection };
  const paginationState: PaginationState = {
    currentPage,
    usersPerPage: USERS_PER_PAGE,
    totalPages: 0
  };

  const resetPagination = () => {
    setCurrentPage(1);
  };

  const handleRuoloChange = (value: string) => {
    setSelectedRuolo(value);
    resetPagination();
  };

  const handleGradoElezioneChange = (value: string) => {
    setSelectedGradoElezione(value);
    resetPagination();
  };

  const updateSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    resetPagination();
  };

  const updateLastUpdateTime = () => {
    setLastUpdateTime(new Date());
  };

  return {
    // State
    searchTerm,
    setSearchTerm,
    selectedRuolo,
    selectedGradoElezione,
    sortState,
    paginationState,
    lastUpdateTime,
    
    // Actions
    updateSort,
    resetPagination,
    updateLastUpdateTime,
    setCurrentPage,
    handleRuoloChange,
    handleGradoElezioneChange
  };
};
