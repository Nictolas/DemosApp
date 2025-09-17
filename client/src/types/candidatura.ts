import { z } from "zod";

export const candidaturaSchema = z.object({
  grado_candidatura: z.string().min(1, "Il grado di candidatura è obbligatorio"),
  paese_candidatura: z.string().min(1, "Il paese di candidatura è obbligatorio"),
  regione_candidatura: z.string().min(1, "La regione di candidatura è obbligatoria"),
  provincia_candidatura: z.string().min(1, "La provincia di candidatura è obbligatoria"),
  comune_candidatura: z.string().min(1, "Il comune di candidatura è obbligatorio"),
});

export type CandidaturaFormValues = z.infer<typeof candidaturaSchema>; 
