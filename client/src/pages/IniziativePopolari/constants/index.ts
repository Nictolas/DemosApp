export const API_ENDPOINTS = {
  INIZIATIVE_LIST: "/api/iniziative-popolari",
  INIZIATIVE_CREATE: "/api/iniziative-popolari",
  INIZIATIVE_UPDATE: (id: string) => `/api/iniziative-popolari/${id}`,
  INIZIATIVE_DELETE: (id: string) => `/api/iniziative-popolari/${id}`,
};

export const QUERY_KEYS = {
  INIZIATIVE_LIST: ['iniziativePopolari'],
};

export const MESSAGES = {
  SUCCESS: {
    CREATED: "Iniziativa popolare proposta con successo!",
    UPDATED: "Iniziativa popolare aggiornata con successo!",
    DELETED: "Iniziativa popolare eliminata con successo!",
  },
  ERROR: {
    CREATE: "Errore nella creazione dell'iniziativa popolare",
    UPDATE: "Errore nell'aggiornamento dell'iniziativa popolare",
    DELETE: "Errore nell'eliminazione dell'iniziativa popolare",
  },
};
