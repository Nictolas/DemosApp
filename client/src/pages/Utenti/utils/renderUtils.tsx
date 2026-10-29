import React from "react";
import { Link } from "wouter";
import { User } from "../types";
import { formatColumnValue } from "./columnUtils";
import { getRoleColor, getCandidaturaStatusColor, getGradoColor } from "./styleUtils";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

// Funzione per renderizzare il valore con targhette colorate
export const renderColumnValue = (value: any, columnName: string, user?: User) => {
  // Gestione speciale per la colonna "avatar"
  if (columnName === 'avatar' && user) {
    if (user.avatar_config) {
      try {
        // Gestisci il caso di doppia serializzazione JSON
        let config;
        if (typeof user.avatar_config === 'string') {
          // Prima prova a fare il parse diretto
          config = JSON.parse(user.avatar_config);
          // Se il risultato è ancora una stringa, fai un secondo parse
          if (typeof config === 'string') {
            config = JSON.parse(config);
          }
        } else {
          config = user.avatar_config;
        }
        return (
          <div className="flex justify-center">
            <div 
              className="w-10 h-10"
            >
              <CustomAvatar config={config} size={40} className="w-full h-full" />
            </div>
          </div>
        );
      } catch (e) {
        console.log(`⚠️ DEBUG renderUtils - Errore parsing avatar per ${user.id}:`, e);
        return (
          <div className="flex justify-center">
            <div 
              className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center"
            >
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          </div>
        );
      }
    } else {
      return (
        <div className="flex justify-center">
          <div 
            className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center"
          >
            <span className="text-gray-500 text-xs">N/A</span>
          </div>
        </div>
      );
    }
  }
  
  if (columnName === 'ruolo' && value) {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(value)}`}>
        {value}
      </span>
    );
  }
  
  if (columnName === 'sesso') {
    if (['ORGANIZATION', 'O', 'INSTITUTION', 'E'].includes(user?.account_type || '')) {
      return <span className="text-sm text-gray-500">Non applicabile</span>;
    }
    const verified = value === 'M' || value === 'F';
    const color = value === 'M'
      ? 'bg-sky-100 text-sky-800 border-sky-200'
      : value === 'F'
        ? 'bg-pink-100 text-pink-800 border-pink-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${color}`}>
        {verified ? (value === 'M' ? 'Maschile' : 'Femminile') : 'Non disponibile'}
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
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getGradoColor(value)}`}>
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
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getGradoColor(value)}`}>
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
