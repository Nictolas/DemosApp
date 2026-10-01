import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

interface Consigliere {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  displayName: string;
  comune_elezione: string;
}

interface ConsiglieriComunaliAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onConsigliereSelect?: (consigliere: Consigliere) => void;
  placeholder?: string;
  className?: string;
  excludedNames?: string[]; // Nomi già selezionati per evitare duplicati
}

export const ConsiglieriComunaliAutocomplete: React.FC<ConsiglieriComunaliAutocompleteProps> = ({
  value,
  onChange,
  onConsigliereSelect,
  placeholder = "Seleziona consigliere comunale",
  className = "",
  excludedNames = []
}) => {
  const { user } = useAuth();
  const isAdmin = user?.ruolo === "AD";
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Query per recuperare tutti i consiglieri comunali del comune dell'utente operante
  const { data: consiglieriData, isLoading } = useQuery({
    queryKey: ['consiglieri-comunali', user?.id],
    queryFn: async () => {
      if (!user?.id || !isAdmin) return { consiglieri: [] };
      
      const response = await apiRequest("GET", `/api/users/consiglieri-comunali`);
      if (!response.ok) throw new Error('Failed to fetch consiglieri comunali');
      return response.json();
    },
    enabled: !!user?.id && isAdmin,
    staleTime: 300000, // Cache per 5 minuti
  });

  const consiglieri = consiglieriData?.consiglieri || [];

  // Filtra i consiglieri in base al termine di ricerca e esclude quelli già selezionati
  const filteredConsiglieri = consiglieri.filter((consigliere: Consigliere) => {
    const matchesSearch = !searchTerm || searchTerm.length < 2 || 
      consigliere.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consigliere.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consigliere.cognome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const notExcluded = !excludedNames.includes(consigliere.displayName);
    
    return matchesSearch && notExcluded;
  });

  // Gestisce la selezione di un consigliere
  const handleConsigliereSelect = (consigliere: Consigliere) => {
    setSearchTerm(consigliere.displayName);
    onChange(consigliere.displayName);
    onConsigliereSelect?.(consigliere);
    setIsOpen(false);
  };

  // Gestisce il cambio di input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(newValue.length >= 1 || isOpen);
  };

  // Gestisce il focus - mostra tutti i consiglieri disponibili
  const handleFocus = () => {
    setIsOpen(true);
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
              Caricamento consiglieri...
            </div>
          ) : filteredConsiglieri.length > 0 ? (
            filteredConsiglieri.map((consigliere: Consigliere) => (
              <button
                key={consigliere.id}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                onClick={() => handleConsigliereSelect(consigliere)}
              >
                <div className="font-medium text-gray-900">{consigliere.displayName}</div>
                <div className="text-xs text-gray-500">{consigliere.comune_elezione}</div>
              </button>
            ))
          ) : searchTerm.length >= 1 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {excludedNames.length > 0 && excludedNames.includes(searchTerm)
                ? "Questo consigliere è già stato selezionato"
                : "Nessun consigliere comunale trovato"}
            </div>
          ) : (
            <div className="px-3 py-2 text-gray-500 text-sm">
              Inizia a digitare per cercare un consigliere comunale
            </div>
          )}
        </div>
      )}
    </div>
  );
};

