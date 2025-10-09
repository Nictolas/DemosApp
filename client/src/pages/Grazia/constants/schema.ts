import { z } from "zod";

export const carceratoSchema = z.object({
  email: z.string().email("Email non valida")
});

export type CarceratoFormData = z.infer<typeof carceratoSchema>;

export const DEFAULT_FORM_VALUES: CarceratoFormData = {
  email: ""
};
