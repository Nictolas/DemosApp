import React from "react";
import { Link } from "wouter";
import { User } from "../types";
import { formatColumnValue } from "./columnUtils";
import { getRoleColor, getGenderColor, getCandidaturaStatusColor } from "./styleUtils";

// Funzione per renderizzare il valore con targhette colorate
export const renderColumnValue = (value: any, columnName: string, user?: User) => {
  if (columnName === 'ruolo' && value) {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(value)}`}>
        {value}
      </span>
    );
  }
  
  if (columnName === 'genere' && value) {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getGenderColor(value)}`}>
        {value}
      </span>
    );
  }
  
  // Gestione speciale per le colonne di candidatura
  if (columnName === 'candidato_attivo') {
    if (value !== null && value !== undefined) {
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
          value ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'
        }`}>
          {value ? 'Sì' : 'No'}
        </span>
      );
    } else {
      return '';
    }
  }
  
  if (columnName === 'status_candidatura') {
    if (value) {
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCandidaturaStatusColor(value)}`}>
          {value}
        </span>
      );
    } else {
      return '';
    }
  }
  
  // Gestione speciale per le colonne di elezione
  if (columnName === 'grado_elezione') {
    if (value) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full border bg-purple-100 text-purple-800 border-purple-200">
          {value}
        </span>
      );
    } else {
      return '';
    }
  }
  
  if (columnName === 'grado_candidatura') {
    if (value) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full border bg-indigo-100 text-indigo-800 border-indigo-200">
          {value}
        </span>
      );
    } else {
      return '';
    }
  }
  
  // Gestione speciale per la colonna "Nome Completo" o "name"
  if ((columnName === 'nome_completo' || columnName === 'name') && user) {
    const displayName = user.nome_completo || user.name || `${user.nome || ''} ${user.cognome || ''}`.trim() || 'N/A';
    return (
      <Link 
        href={`/menu/profilo/${user.id}?from=utenti`} 
        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
      >
        {displayName}
      </Link>
    );
  }
  
  return formatColumnValue(value, columnName, user);
};
