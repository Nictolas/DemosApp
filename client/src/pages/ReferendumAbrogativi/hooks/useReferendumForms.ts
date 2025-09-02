import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { referendumSchema, ReferendumFormData } from "../types";
import { DEFAULT_FORM_VALUES } from "../constants";

export const useReferendumForms = () => {
  // Form per la creazione
  const createForm = useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema),
    defaultValues: DEFAULT_FORM_VALUES
  });

  // Form per la modifica
  const editForm = useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema)
  });

  // Funzione per resettare il form di creazione
  const resetCreateForm = () => {
    createForm.reset(DEFAULT_FORM_VALUES);
  };

  // Funzione per popolare il form di modifica
  const populateEditForm = (referendum: any) => {
    editForm.reset({
      nome: referendum.nome || "",
      descrizione: referendum.descrizione || "",
      dataInizio: referendum.dataInizio || "",
      dataFine: referendum.dataFine || "",
      sitoWeb: referendum.sitoWeb || ""
    });
  };

  return {
    createForm,
    editForm,
    resetCreateForm,
    populateEditForm
  };
};
