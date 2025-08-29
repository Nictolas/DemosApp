import { z } from "zod";

// Schema Zod per la validazione
export const elezioneSchema = z.object({
  tipo: z.enum(['sovranazione', 'stato', 'regione', 'provincia', 'comune']),
  zona: z.string().min(1, "Zona è richiesta"),
  datainizio: z.string().min(1, "Anno inizio è richiesto"),
  datafine: z.string().min(1, "Anno fine è richiesto"),
  circa: z.boolean().default(true),
});

export type ElezioneForm = z.infer<typeof elezioneSchema>;

// Interfaccia per l'elezione
export interface Elezione {
  id: string;
  tipo: string; // 'sovranazione', 'stato', 'regione', 'provincia', 'comune'
  zona: string;
  circa: boolean;
  datainizio: string; // Anno come stringa
  datafine: string; // Anno come stringa
  createdAt: string;
  updatedAt: string;
}

// Props per i componenti
export interface ElectionsHeaderProps {
  onAddNew: () => void;
}

export interface ElectionsStatsProps {
  elezioni: Elezione[];
}

export interface ElectionFormProps {
  editingElezione: Elezione | null;
  onSubmit: (data: ElezioneForm) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

export interface ElectionsListProps {
  elezioni: Elezione[];
  loading: boolean;
  onEdit: (elezione: Elezione) => void;
  onDelete: (id: string) => void;
}

export interface ElectionCardProps {
  elezione: Elezione;
  onEdit: (elezione: Elezione) => void;
  onDelete: (id: string) => void;
}

export interface ElectionsLoadingProps {
  loading: boolean;
}

export interface ElectionsEmptyProps {
  elezioni: Elezione[];
}
