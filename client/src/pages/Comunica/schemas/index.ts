import { z } from "zod";

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

export type ComunicaFormData = z.infer<typeof comunicaSchema>;
export type EventoFormData = z.infer<typeof eventoSchema>;
