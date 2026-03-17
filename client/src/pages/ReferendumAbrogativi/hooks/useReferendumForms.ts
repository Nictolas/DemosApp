import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { referendumSchema } from "../types";
import { ReferendumFormData } from "../types";

export const useReferendumForms = () => {
  const [createForm] = useState(() => useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema),
    defaultValues: {
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: ""
    }
  }));

  const [editForm] = useState(() => useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema),
    defaultValues: {
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: ""
    }
  }));

  const resetCreateForm = () => {
    createForm.reset({
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: ""
    });
  };

  return {
    createForm,
    editForm,
    resetCreateForm
  };
};