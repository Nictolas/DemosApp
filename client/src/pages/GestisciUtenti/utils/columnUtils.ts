import { User } from "../types";
import { HIDDEN_COLUMNS, FORCED_COLUMNS, PRIORITY_COLUMNS } from "../constants";

// Funzione per ottenere le colonne da mostrare
export const getDisplayColumns = (users: any[]) => {
  if (!users || users.length === 0) return [];
  
  const firstUser = users[0];
  if (!firstUser || typeof firstUser !== 'object') return [];
  
  const allColumns = Object.keys(firstUser);
  
  // Filtra le colonne nascoste
  const displayColumns = allColumns.filter(col => !HIDDEN_COLUMNS.includes(col));
  
  // Aggiungi colonna "Avatar" e "Nome Completo" all'inizio
  const columnsWithAvatarAndFullName = ['avatar', 'nome_completo', ...displayColumns];
  
  // Aggiungi le colonne forzate se non sono già presenti
  const allRequiredColumns = [...new Set([...columnsWithAvatarAndFullName, ...FORCED_COLUMNS])];
  
  // Ordina le colonne in modo logico con priorità per candidatura ed elezione
  const sortedColumns = [
    ...PRIORITY_COLUMNS.filter(col => allRequiredColumns.includes(col)),
    ...allRequiredColumns.filter(col => !PRIORITY_COLUMNS.includes(col))
  ];
  
  return sortedColumns;
};

// Funzione per formattare il valore di una colonna
export const formatColumnValue = (value: any, columnName: string, user?: User) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Formatta date
  if (columnName.includes('_at') || columnName.includes('data_')) {
    try {
      return new Date(value).toLocaleDateString('it-IT', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return value;
    }
  }
  
  // Formatta booleani
  if (typeof value === 'boolean') {
    return value ? 'Sì' : 'No';
  }
  
  // Formatta JSON
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
  }
  
  return String(value);
};
