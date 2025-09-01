import { User } from './types';
import { 
  HIDDEN_COLUMNS, 
  FORCED_COLUMNS, 
  PRIORITY_COLUMNS, 
  ROLE_COLORS, 
  GENDER_COLORS, 
  CANDIDACY_STATUS_COLORS,
  COLUMN_NAMES 
} from './constants';

// Funzione per ottenere le colonne da mostrare
export const getDisplayColumns = (users: any[]): string[] => {
  if (!users || users.length === 0) return [];
  
  const firstUser = users[0];
  const allColumns = Object.keys(firstUser);
  
  // Filtra le colonne nascoste
  const displayColumns = allColumns.filter(col => !HIDDEN_COLUMNS.includes(col));
  
  // Aggiungi colonna "Nome Completo" all'inizio
  const columnsWithFullName = ['nome_completo', ...displayColumns];
  
  // Aggiungi le colonne forzate se non sono già presenti
  const allRequiredColumns = [...new Set([...columnsWithFullName, ...FORCED_COLUMNS])];
  
  // Ordina le colonne in modo logico con priorità per candidatura ed elezione
  const sortedColumns = [
    ...PRIORITY_COLUMNS.filter(col => allRequiredColumns.includes(col)),
    ...allRequiredColumns.filter(col => !PRIORITY_COLUMNS.includes(col))
  ];
  
  return sortedColumns;
};

// Funzione per ottenere il colore del ruolo
export const getRoleColor = (ruolo: string): string => {
  return ROLE_COLORS[ruolo?.toLowerCase() as keyof typeof ROLE_COLORS] || ROLE_COLORS.default;
};

// Funzione per ottenere il colore del genere
export const getGenderColor = (genere: string): string => {
  return GENDER_COLORS[genere?.toLowerCase() as keyof typeof GENDER_COLORS] || GENDER_COLORS.default;
};

// Funzione per formattare il valore di una colonna
export const formatColumnValue = (value: any, columnName: string, user?: User): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Formatta date
  if (columnName.includes('_at') || columnName.includes('data_')) {
    try {
      return new Date(value).toLocaleDateString('it-IT');
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

// Funzione per renderizzare il valore con targhette colorate
export const renderColumnValue = (value: any, columnName: string, user?: User): React.ReactNode => {
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
      const colorClass = CANDIDACY_STATUS_COLORS[value as keyof typeof CANDIDACY_STATUS_COLORS] || CANDIDACY_STATUS_COLORS.default;
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colorClass}`}>
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
  
  return formatColumnValue(value, columnName, user);
};

// Funzione per ottenere il nome della colonna per la visualizzazione
export const getColumnDisplayName = (columnName: string): string => {
  return COLUMN_NAMES[columnName as keyof typeof COLUMN_NAMES] || columnName;
};

// Funzione per filtrare e ordinare gli utenti
export const filterAndSortUsers = (
  users: User[], 
  searchTerm: string, 
  sortField: keyof User, 
  sortDirection: "asc" | "desc",
  displayColumns: string[]
): User[] => {
  if (!Array.isArray(users)) {
    console.warn('⚠️ utenti non è un array:', users);
    return [];
  }
  
  return users
    .filter(u => {
      // Gestione filtri rapidi
      if (searchTerm === 'candidato:attivo') {
        return u.candidato_attivo === true;
      }
      if (searchTerm === 'elezione:comune') {
        return u.grado_elezione === 'comune' || u.grado_candidatura === 'comune';
      }
      if (searchTerm === 'elezione:regionale') {
        return u.grado_elezione === 'regionale' || u.grado_candidatura === 'regionale';
      }
      if (searchTerm === 'elezione:nazionale') {
        return u.grado_elezione === 'nazionale' || u.grado_candidatura === 'nazionale';
      }
      
      // Ricerca normale su tutte le colonne di testo
      const searchLower = searchTerm.toLowerCase();
      
      // Ricerca speciale per nome completo
      const fullName = `${u.nome || ''} ${u.cognome || ''}`.toLowerCase();
      if (fullName.includes(searchLower)) return true;
      
      return displayColumns.some(col => {
        const value = u[col];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchLower);
        }
        return false;
      });
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      
      // Gestione speciale per la colonna nome_completo
      if (sortField === 'nome_completo') {
        const fullNameA = `${a.nome || ''} ${a.cognome || ''}`.toLowerCase();
        const fullNameB = `${b.nome || ''} ${b.cognome || ''}`.toLowerCase();
        if (fullNameA < fullNameB) return sortDirection === "asc" ? -1 : 1;
        if (fullNameA > fullNameB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }
      
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
};
