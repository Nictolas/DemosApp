export const API_ENDPOINTS = {
  MINISTERI: '/api/ministeri',
  MINISTERI_BY_ID: (id: string) => `/api/ministeri/${id}`,
} as const;

export const QUERY_KEYS = {
  MINISTERI: ['ministeri'],
} as const;

export const TOAST_MESSAGES = {
  SUCCESS: {
    ADD: 'Ministero aggiunto.',
    UPDATE: 'Ministero aggiornato.',
    DELETE: 'Ministero eliminato.',
  },
  ERROR: {
    ADD: 'Impossibile aggiungere il ministero.',
    UPDATE: 'Impossibile aggiornare il ministero.',
    DELETE: 'Impossibile eliminare il ministero.',
    LOAD: 'Errore nel caricamento dei ministeri',
  },
  VALIDATION: {
    REQUIRED_FIELDS: 'Nome e categoria sono obbligatori.',
  },
  CONFIRM: {
    DELETE: 'Sei sicuro di voler eliminare questo ministero?',
  },
} as const;

export const FORM_LABELS = {
  NOME: 'Nome ministero',
  CATEGORIA: 'Categoria (slug)',
  DESCRIZIONE: 'Descrizione (opzionale)',
  AGGIUNGI: 'Aggiungi',
  MODIFICA: 'Modifica',
  ELIMINA: 'Elimina',
  SALVA: 'Salva',
  ANNULLA: 'Annulla',
} as const;
