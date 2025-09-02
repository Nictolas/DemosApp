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
  quorum: 'ok' | 'pending' | 'no';
}

// Interfaccia per lo stato del componente
export interface ReferendumAbrogativiState {
  showForm: boolean;
  editReferendum: Referendum | null;
}

// Interfaccia per le props dei componenti
export interface ReferendumTableProps {
  listaReferendum: Referendum[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (referendum: Referendum) => void;
  onDelete: (id: string) => void;
  onQuorumChange: (id: string, quorum: 'ok' | 'pending' | 'no') => void;
  deleteMutation: any;
  quorumMutation: any;
}

export interface ReferendumFormProps {
  form: any;
  onSubmit: (data: ReferendumFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  title: string;
}

export interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referendum: Referendum | null;
  form: any;
  onSubmit: (data: ReferendumFormData) => void;
  isPending: boolean;
}

// Interfaccia per il cambio quorum
export interface QuorumChangeData {
  id: string;
  quorum: 'ok' | 'pending' | 'no';
}
