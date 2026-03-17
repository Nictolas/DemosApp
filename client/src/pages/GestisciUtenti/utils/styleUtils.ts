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

// Funzione per ottenere il colore dello status candidatura
export const getCandidaturaStatusColor = (status: string) => {
  switch (status) {
    case 'attiva':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'in_attesa':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'approvata':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'rifiutata':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};
