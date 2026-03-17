import { z } from "zod";

export const registrationSchema = z.object({
  nome: z.string()
    .min(2, "Il nome deve essere di almeno 2 caratteri")
    .max(50, "Il nome non può superare i 50 caratteri")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Il nome può contenere solo lettere e spazi"),
  
  cognome: z.string()
    .min(2, "Il cognome deve essere di almeno 2 caratteri")
    .max(50, "Il cognome non può superare i 50 caratteri")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Il cognome può contenere solo lettere e spazi"),
  
  genere: z.string()
    .min(1, "Seleziona un genere"),
  
  cittadinanza: z.string()
    .min(1, "Seleziona una cittadinanza"),
  
  dataNascita: z.string()
    .min(1, "Inserisci la data di nascita")
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 18 && age <= 120;
    }, "Devi avere almeno 18 anni e non più di 120"),
  
  indirizzo: z.string()
    .min(5, "L'indirizzo deve essere di almeno 5 caratteri")
    .max(100, "L'indirizzo non può superare i 100 caratteri"),
  
  cap: z.string()
    .min(5, "Il CAP deve essere di 5 cifre")
    .max(5, "Il CAP deve essere di 5 cifre")
    .regex(/^\d{5}$/, "Il CAP deve contenere solo numeri"),
  
  comune: z.string()
    .min(1, "Seleziona un comune"),
  
  provincia: z.string()
    .min(1, "Seleziona una provincia"),
  
  regione: z.string()
    .min(1, "Seleziona una regione"),
  
  telefono: z.string()
    .min(10, "Il numero di telefono deve essere di almeno 10 cifre")
    .max(15, "Il numero di telefono non può superare i 15 caratteri")
    .regex(/^[\+]?[0-9\s\-\(\)]+$/, "Formato numero di telefono non valido"),
  
  email: z.string()
    .email("Formato email non valido")
    .min(5, "L'email deve essere di almeno 5 caratteri")
    .max(100, "L'email non può superare i 100 caratteri")
});

export type RegistrationFormData = z.infer<typeof registrationSchema>;
