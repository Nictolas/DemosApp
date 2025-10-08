import { z } from "zod";

export const iniziativaSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().min(1, "Il sito web è obbligatorio").refine((val) => {
    if (!val) return false;
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(val);
  }, "Inserisci un URL valido"),
});

export const DEFAULT_FORM_VALUES = {
  nome: "",
  descrizione: "",
  dataInizio: "",
  dataFine: "",
  sitoWeb: "",
};
