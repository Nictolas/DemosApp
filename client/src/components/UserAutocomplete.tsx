import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

interface User {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  displayName: string;
}

interface UserAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (user: User) => void;
  placeholder?: string;
  className?: string;
}

export const UserAutocomplete: React.FC<UserAutocompleteProps> = ({
  value,
  onChange,
  onUserSelect,
  placeholder = "Inserisci nome",
  className = ""
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Query per cercare utenti
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['users-search', searchTerm, user?.id],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2 || !user) return { users: [] };
      
      const response = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Failed to search users');
      return response.json();
    },
    enabled: searchTerm.length >= 2 && !!user,
    staleTime: 30000, // Cache per 30 secondi
  });

  const users = searchResults?.users || [];

  // Gestisce la selezione di un utente
  const handleUserSelect = (user: User) => {
    setSearchTerm(user.displayName);
    onChange(user.displayName);
    onUserSelect?.(user);
    setIsOpen(false);
  };

  // Gestisce il cambio di input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(newValue.length >= 2);
  };

  // Gestisce il focus
  const handleFocus = () => {
    if (searchTerm.length >= 2) {
      setIsOpen(true);
    }
  };

  // Gestisce il click fuori dal componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sincronizza searchTerm con value quando cambia dall'esterno
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {isLoading ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              Cercando...
            </div>
          ) : users.length > 0 ? (
            users.map((user: User) => (
              <button
                key={user.id}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                onClick={() => handleUserSelect(user)}
              >
                <div className="font-medium text-gray-900">{user.displayName}</div>
              </button>
            ))
          ) : searchTerm.length >= 2 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              Nessun utente trovato
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
