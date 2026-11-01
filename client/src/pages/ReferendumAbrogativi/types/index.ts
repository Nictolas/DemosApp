import { z } from "zod";

// Schema di validazione Zod
export const referendumSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")).optional(),
  firme: z.number().min(0, "Le firme devono essere un numero positivo").optional(),
});

// Tipo inferito dal schema
export type ReferendumFormData = z.infer<typeof referendumSchema>;

// Interfaccia per i referendum
export interface Referendum extends ReferendumFormData {
  id: string;
  id_ministero?: string | number;
  quorum: 'ok' | 'pending' | 'no' | 'proposta';
  data_creazione: string;
  votiices?: number;
  firme?: number;
  firme_raccolte?: number;
  esito?: string;
  status?: string;
  sitoWeb?: string;
  sito_web?: string;
  sitoweb?: string;
  emoji?: string;
}

// Interfaccia per lo stato del componente
export interface ReferendumAbrogativiState {
  showForm: boolean;
  editReferendum: Referendum | null;
  viewReferendum: Referendum | null;
}

// Interfaccia per le props dei componenti
export interface ReferendumTableProps {
  listaReferendum: Referendum[];
  mieiVoti: string[];
  isLoading: boolean;
  isError: boolean;
  onView?: (referendum: Referendum) => void;
}

export interface ReferendumFormProps {
  onSubmit: (data: ReferendumFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export interface EditDialogProps {
  referendum: Referendum | null;
  onClose: () => void;
  onSubmit: (data: ReferendumFormData & { quorum?: string }) => void;
  isLoading: boolean;
}

export interface ViewDialogProps {
  referendum: Referendum | null;
  onClose: () => void;
  onEdit?: (referendum: Referendum) => void;
  onDelete?: (id: string) => void;
  deleteMutation?: any;
}

// Interfaccia per il cambio quorum
export interface QuorumChangeData {
  id: string;
  quorum: 'ok' | 'pending' | 'no';
}

// Costanti
export const QUERY_KEYS = {
  REFERENDUM_LIST: ['referendumAbrogativi'],
};

export const API_ENDPOINTS = {
  REFERENDUM_LIST: "/api/referendum-abrogativi",
  REFERENDUM_CREATE: "/api/referendum-abrogativi",
  REFERENDUM_UPDATE: (id: string) => `/api/referendum-abrogativi/${id}`,
  REFERENDUM_DELETE: (id: string) => `/api/referendum-abrogativi/${id}`,
};

export const MESSAGES = {
  SUCCESS: {
    CREATED: "Referendum abrogativo proposto con successo!",
    UPDATED: "Referendum abrogativo aggiornato con successo!",
    DELETED: "Referendum abrogativo eliminato con successo!",
  },
  ERROR: {
    CREATE: "Errore nella creazione del referendum abrogativo",
    UPDATE: "Errore nell'aggiornamento del referendum abrogativo",
    DELETE: "Errore nell'eliminazione del referendum abrogativo",
  },
};
