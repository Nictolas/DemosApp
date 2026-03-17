import { z } from "zod";

export const amnistiaSchema = z.object({
  legge: z.string().min(1, "La legge è obbligatoria"),
  articolo: z.string().min(1, "L'articolo è obbligatorio"),
  descrizione: z.string().min(10, "La descrizione deve essere di almeno 10 caratteri")
});

export type AmnistiaFormData = z.infer<typeof amnistiaSchema>;

export const DEFAULT_FORM_VALUES: AmnistiaFormData = {
  legge: "",
  articolo: "",
  descrizione: ""
};
