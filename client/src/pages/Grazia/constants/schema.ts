import { z } from "zod";

export const carceratoSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  motivo: z.string().min(10, "Il motivo deve essere di almeno 10 caratteri"),
  dettagli: z.string().optional()
});

export type CarceratoFormData = z.infer<typeof carceratoSchema>;

export const DEFAULT_FORM_VALUES: CarceratoFormData = {
  nome: "",
  cognome: "",
  motivo: "",
  dettagli: ""
};
