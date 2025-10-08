import { z } from "zod";

// Schema di validazione Zod
export const referendumSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")).optional(),
});

// Tipo inferito dal schema
export type ReferendumFormData = z.infer<typeof referendumSchema>;

// Interfaccia per i referendum
export interface Referendum extends ReferendumFormData {
  id: string;
  quorum: 'ok' | 'pending' | 'no' | 'proposta';
  data_creazione: string;
  votiices?: number;
  firme?: number;
  esito?: string;
  status?: string;
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
