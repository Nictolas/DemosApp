import { User } from "./types";

// Colonne da escludere dalla visualizzazione
const HIDDEN_COLUMNS = [
  // Colonne delle opinioni
  'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
  'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
  'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia',
  // Colonne specifiche da nascondere
  'id', 'nome', 'cognome', 'password_hash', 'avatar_config', 'fonti_opinioni'
];

// Funzione per ottenere le colonne da mostrare
export const getDisplayColumns = (users: any[]) => {
  if (!users || users.length === 0) return [];
  
  const firstUser = users[0];
  const allColumns = Object.keys(firstUser);
  
  // Filtra le colonne nascoste
  const displayColumns = allColumns.filter(col => !HIDDEN_COLUMNS.includes(col));
  
  // Aggiungi colonna "Nome Completo" all'inizio
  const columnsWithFullName = ['nome_completo', ...displayColumns];
  
  // FORZA la presenza delle colonne di candidatura ed elezione anche se non sono nei dati
  const forcedColumns = [
    'candidato_attivo', 'status_candidatura', 'grado_candidatura',
    'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
    'data_candidatura', 'note_candidatura',
    'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione'
  ];
  
  // Aggiungi le colonne forzate se non sono già presenti
  const allRequiredColumns = [...new Set([...columnsWithFullName, ...forcedColumns])];
  
  // Ordina le colonne in modo logico con priorità per candidatura ed elezione
  const priorityColumns = [
    'nome_completo', 'email', 'ruolo', 'status',
    // Colonne candidatura (priorità alta)
    'candidato_attivo', 'status_candidatura', 'grado_candidatura',
    'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
    'data_candidatura', 'note_candidatura',
    // Colonne elezione (priorità alta)
    'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione'
  ];
  
  const sortedColumns = [
    ...priorityColumns.filter(col => allRequiredColumns.includes(col)),
    ...allRequiredColumns.filter(col => !priorityColumns.includes(col))
  ];
  
  return sortedColumns;
};

// Funzione per ottenere il colore del ruolo
export const getRoleColor = (ruolo: string) => {
  switch (ruolo?.toLowerCase()) {
    case 'politico':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'candidato':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'candidato politico':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'admin':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Funzione per ottenere il colore del genere
export const getGenderColor = (genere: string) => {
  switch (genere?.toLowerCase()) {
    case 'uomo':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'donna':
      return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'altro':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
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
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
          value === 'attiva' ? 'bg-blue-100 text-blue-800 border-blue-200' :
          value === 'in_attesa' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
          value === 'approvata' ? 'bg-green-100 text-green-800 border-green-200' :
          value === 'rifiutata' ? 'bg-red-100 text-red-800 border-red-200' :
          'bg-gray-100 text-gray-800 border-gray-200'
        }`}>
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
    return (
      <a 
        href={`/menu/profilo/${user.id}?from=utenti`} 
        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
      >
        {user.nome} {user.cognome}
      </a>
    );
  }
  
  return formatColumnValue(value, columnName, user);
};
