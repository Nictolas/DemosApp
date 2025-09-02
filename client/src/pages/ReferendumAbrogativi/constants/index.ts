// Valori di default per i form
export const DEFAULT_FORM_VALUES = {
  nome: "",
  descrizione: "",
  dataInizio: "",
  dataFine: "",
  sitoWeb: ""
};

// Query keys per React Query
export const QUERY_KEYS = {
  REFERENDUM_LIST: ['referendumList'],
  REFERENDUM_DETAIL: (id: string) => ['referendum', id]
};

// API endpoints
export const API_ENDPOINTS = {
  REFERENDUM_LIST: "/api/referendum-abrogativi",
  REFERENDUM_CREATE: "/api/referendum-abrogativi",
  REFERENDUM_UPDATE: (id: string) => `/api/referendum-abrogativi/${id}`,
  REFERENDUM_DELETE: (id: string) => `/api/referendum-abrogativi/${id}`,
  REFERENDUM_QUORUM: (id: string) => `/api/referendum-abrogativi/${id}/quorum`
};

// Messaggi di successo e errore
export const MESSAGES = {
  SUCCESS: {
    CREATED: "Referendum creato con successo!",
    UPDATED: "Referendum aggiornato con successo!",
    DELETED: "Referendum eliminato con successo!",
    QUORUM_UPDATED: "Quorum aggiornato con successo!"
  },
  ERROR: {
    LOAD: "Errore nel caricamento dei referendum",
    CREATE: "Errore nella creazione del referendum",
    UPDATE: "Errore nell'aggiornamento del referendum",
    DELETE: "Errore nell'eliminazione del referendum",
    QUORUM_UPDATE: "Errore nell'aggiornamento del quorum"
  }
};

// Stati del quorum
export const QUORUM_STATUS = {
  OK: 'ok',
  PENDING: 'pending',
  NO: 'no'
} as const;

// Colori per i badge del quorum
export const QUORUM_COLORS = {
  ok: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  no: 'bg-red-100 text-red-800'
} as const;

// Opzioni per il quorum con icone
export const QUORUM_OPTIONS = [
  { value: 'ok', label: 'Raggiunto', icon: 'Check' },
  { value: 'pending', label: 'In attesa', icon: 'Hourglass' },
  { value: 'no', label: 'Non raggiunto', icon: 'X' }
] as const;
