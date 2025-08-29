import { z } from "zod";

// Zod schemas
export const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il tuo voto",
  }),
  commento: z.string().max(20, "Il commento non può superare i 20 caratteri").optional(),
  vincitore: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il vincitore",
  }),
});

export const eventoSchema = z.object({
  dove: z.string().min(1, "Il luogo è obbligatorio"),
  quando: z.string().min(1, "La data è obbligatoria"),
});

// TypeScript types
export type ComunicaFormData = z.infer<typeof comunicaSchema>;
export type EventoFormData = z.infer<typeof eventoSchema>;

export interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

export interface LastCommunication {
  comunicazione: {
    titolo: string;
    voto_dato: "Favorevole" | "Contrario" | "Astenuto";
    vincitore: "Favorevole" | "Contrario" | "Astenuto";
    commento?: string;
    zona: string;
    data_creazione: string;
    likes?: number;
    dislikes?: number;
  };
}

export interface NavigationButton {
  id: string;
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  showForRoles?: string[];
}

export interface AccessControlProps {
  user: any;
  children: React.ReactNode;
}

export interface NavigationButtonsProps {
  user: any;
  onNavigate: (path: string) => void;
}

export interface LastCommunicationProps {
  communication: LastCommunication | null;
}
