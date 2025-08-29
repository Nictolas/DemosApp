import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
});

export const registerSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
  codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri"),
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
  genere: z.string().min(1, "Il genere è obbligatorio"),
  cittadinanza: z.string().min(1, "La cittadinanza è obbligatoria"),
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  grado_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
}).superRefine((data, ctx) => {
  // Politico: obbligatori solo i campi elezione
  if (data.ruolo === "Politico") {
    if (!data.paese_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il paese di elezione è obbligatorio", path: ["paese_elezione"] });
    if (!data.regione_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La regione di elezione è obbligatoria", path: ["regione_elezione"] });
    if (!data.provincia_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La provincia di elezione è obbligatoria", path: ["provincia_elezione"] });
    if (!data.comune_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il comune di elezione è obbligatorio", path: ["comune_elezione"] });
  }
  // Candidato: obbligatori solo i campi candidatura
  if (data.ruolo === "Candidato") {
    if (!data.paese_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il paese di candidatura è obbligatorio", path: ["paese_candidatura"] });
    if (!data.regione_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La regione di candidatura è obbligatoria", path: ["regione_candidatura"] });
    if (!data.provincia_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La provincia di candidatura è obbligatoria", path: ["provincia_candidatura"] });
    if (!data.comune_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il comune di candidatura è obbligatorio", path: ["comune_candidatura"] });
  }
  // Candidato Politico: obbligatori entrambi
  if (data.ruolo === "Candidato Politico") {
    // Elezione
    if (!data.paese_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il paese di elezione è obbligatorio", path: ["paese_elezione"] });
    if (!data.regione_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La regione di elezione è obbligatoria", path: ["regione_elezione"] });
    if (!data.provincia_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La provincia di elezione è obbligatoria", path: ["provincia_elezione"] });
    if (!data.comune_elezione) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il comune di elezione è obbligatorio", path: ["comune_elezione"] });
    // Candidatura
    if (!data.paese_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il paese di candidatura è obbligatorio", path: ["paese_candidatura"] });
    if (!data.regione_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La regione di candidatura è obbligatoria", path: ["regione_candidatura"] });
    if (!data.provincia_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La provincia di candidatura è obbligatoria", path: ["provincia_candidatura"] });
    if (!data.comune_candidatura) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Il comune di candidatura è obbligatorio", path: ["comune_candidatura"] });
  }
}, {
  message: "Compila tutti i campi obbligatori per il tuo ruolo",
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
