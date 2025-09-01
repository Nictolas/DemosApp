import { z } from "zod";

export const elezioneSchema = z.object({
  tipo: z.enum(['sovranazione', 'stato', 'regione', 'provincia', 'comune']),
  zona: z.string().min(1, "Zona è richiesta"),
  datainizio: z.string().min(1, "Anno inizio è richiesto"),
  datafine: z.string().min(1, "Anno fine è richiesto"),
  circa: z.boolean().default(true),
});

export type ElezioneForm = z.infer<typeof elezioneSchema>;
