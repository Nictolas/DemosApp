// Funzione per ottenere il colore del ruolo
export const getRoleColor = (ruolo: string) => {
  switch (ruolo?.toLowerCase()) {
    case 'politico':
    case 'p':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'candidato':
    case 'c':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'candidato politico':
    case 'cp':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'admin':
    case 'ad':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'elettore':
    case 'e':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'attivista':
    case 'a':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Funzione per ottenere il colore del genere
export const getGenderColor = (genere: string) => {
  switch (genere?.toLowerCase()) {
    case 'uomo':
    case 'u':
      return 'bg-sky-100 text-sky-800 border-sky-200'; // Azzurro
    case 'donna':
    case 'd':
      return 'bg-pink-100 text-pink-800 border-pink-200'; // Rosa
    case 'altro':
    case 'a':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Giallo
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

// Funzione per ottenere il colore del grado di elezione/candidatura
export const getGradoColor = (grado: string) => {
  switch (grado?.toUpperCase()) {
    case 'E':
      return 'bg-blue-100 text-blue-800 border-blue-200'; // Blu
    case 'S':
      return 'bg-red-100 text-red-800 border-red-200'; // Rosso
    case 'C':
      return 'bg-green-100 text-green-800 border-green-200'; // Verde
    case 'R':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Giallo
    case 'CO':
      return 'bg-gray-100 text-gray-800 border-gray-200'; // Grigio
    case 'N':
      return 'bg-purple-100 text-purple-800 border-purple-200'; // Viola
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};
