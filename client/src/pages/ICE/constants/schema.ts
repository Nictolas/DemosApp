import { z } from "zod";

export const iceSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().min(1, "Il sito web è obbligatorio").refine((val) => {
    // Validazione URL più permissiva
    if (!val) return false;
    // Accetta URL con o senza protocollo
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(val);
  }, "Inserisci un URL valido"),
});

export const DEFAULT_FORM_VALUES = {
  nome: "",
  descrizione: "",
  dataInizio: "",
  dataFine: "",
  sitoWeb: ""
};

export const QUERY_KEYS = {
  ICE_LIST: ['iceList']
};

export const API_ENDPOINTS = {
  ICE_LIST: "/api/ice",
  ICE_CREATE: "/api/ice",
  ICE_UPDATE: (id: string) => `/api/ice/${id}`,
  ICE_DELETE: (id: string) => `/api/ice/${id}`
};

export const MESSAGES = {
  SUCCESS: {
    CREATED: "ICE proposta",
    UPDATED: "ICE modificata",
    DELETED: "ICE cancellata"
  },
  ERROR: {
    LOAD: "Errore nel caricamento delle ICE",
    CREATE: "Impossibile proporre l'ICE",
    UPDATE: "Impossibile aggiornare l'ICE",
    DELETE: "Impossibile cancellare l'ICE"
  }
};
