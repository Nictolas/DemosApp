import { z } from "zod";

export const iniziativaSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.union([
    z.string().url("Inserisci un URL valido"),
    z.literal("")
  ]).optional(),
});

export const DEFAULT_FORM_VALUES = {
  nome: "",
  descrizione: "",
  dataInizio: "",
  dataFine: "",
  sitoWeb: "",
};
