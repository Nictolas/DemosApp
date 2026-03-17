import { useState, useEffect } from "react";
import { User, SortState, PaginationState } from "../types";
import { USERS_PER_PAGE } from "../constants";

export const useUserManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEditOpinioniDialog, setShowEditOpinioniDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
    userToDelete,
    setUserToDelete,
    showEditDialog,
    setShowEditDialog,
    showEditOpinioniDialog,
    setShowEditOpinioniDialog,
    selectedUser,
    setSelectedUser,
    sortState,
    paginationState,
    lastUpdateTime,
    
    // Actions
    updateSort,
    resetPagination,
    updateLastUpdateTime,
    setCurrentPage
  };
};
