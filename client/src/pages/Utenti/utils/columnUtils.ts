import { User } from "../types";
import { HIDDEN_COLUMNS, FORCED_COLUMNS, PRIORITY_COLUMNS } from "../constants";

// Funzione per creare il nome completo
export const createFullName = (user: any) => {
  if (user.nome_completo) return user.nome_completo;
  if (user.nome && user.cognome) return `${user.nome} ${user.cognome}`;
  if (user.name) return user.name;
  if (user.nome) return user.nome;
  if (user.cognome) return user.cognome;
  return 'N/A';
};

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
  
  // Assicurati che nome_completo sia sempre presente
  if (!displayColumns.includes('nome_completo')) {
    columnsWithAvatarAndFullName.splice(1, 0, 'nome_completo');
  }
  
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
  if (columnName === 'sesso') {
    if (['ORGANIZATION', 'O', 'INSTITUTION', 'E'].includes(user?.account_type || '')) return 'Non applicabile';
    return value === 'M' ? 'Maschile' : value === 'F' ? 'Femminile' : 'Non disponibile';
  }
  if (value === null || value === undefined) {
    return '';
  }
  
  // Gestisci nome_completo
  if (columnName === 'nome_completo' && user) {
    return createFullName(user);
  }
  
  // Formatta date
  if (columnName.includes('_at') || columnName.includes('data_') || columnName === 'data_nascita') {
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
  
  // Formatta URL social media
  if (columnName.includes('_url') && typeof value === 'string' && value.length > 0) {
    return value.length > 30 ? value.substring(0, 30) + '...' : value;
  }
  
  // Formatta auth_method
  if (columnName === 'auth_method') {
    const authMap: Record<string, string> = {
      'credentials': 'Email/Password',
      'google': 'Google',
      'facebook': 'Facebook',
      'apple': 'Apple'
    };
    return authMap[value] || value;
  }
  
  // Formatta consensi
  if (columnName.includes('_consent')) {
    return value ? '✅ Accettato' : '❌ Non accettato';
  }
  
  // Formatta preferenze notifiche
  if (columnName.includes('notifications') || columnName.includes('visibility') || columnName.includes('public')) {
    return value ? '✅ Abilitato' : '❌ Disabilitato';
  }
  
  // Formatta premium/admin
  if (columnName === 'premium' || columnName === 'is_premium') {
    return value ? '⭐ Premium' : '👤 Standard';
  }
  
  if (columnName === 'is_admin') {
    return value ? '👑 Admin' : '👤 Utente';
  }
  
  // Formatta verified
  if (columnName === 'verified') {
    return value ? '✅ Verificato' : '⏳ Non verificato';
  }
  
  // Formatta JSON
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
  }
  
  return String(value);
};
