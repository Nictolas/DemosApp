import { z } from "zod";

// Only a subject label and a public HTTPS reference. Never request convictions,
// judgments, private documents or contact details in a proposal.
export const carceratoSchema = z.object({
  nome: z.string().trim().min(3, "Inserisci un nome valido").max(160, "Nome troppo lungo"),
  urlProva: z.string().trim().url("Inserisci un URL valido").max(2000, "URL troppo lungo")
    .refine((value) => value.startsWith("https://"), "La fonte deve usare HTTPS"),
});

export type CarceratoFormData = z.infer<typeof carceratoSchema>;

export const DEFAULT_FORM_VALUES: CarceratoFormData = {
  nome: "",
  urlProva: "",
};
