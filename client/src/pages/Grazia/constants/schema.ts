import { z } from "zod";

export const carceratoSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  email: z.string().email("Email non valida")
});

export type CarceratoFormData = z.infer<typeof carceratoSchema>;

export const DEFAULT_FORM_VALUES: CarceratoFormData = {
  nome: "",
  cognome: "",
  email: ""
};
