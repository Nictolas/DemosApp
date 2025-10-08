import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { iniziativaSchema, DEFAULT_FORM_VALUES } from "../constants/schema";
import { IniziativaFormData } from "../types";

export const useIniziativeForms = () => {
  const [createForm] = useState(() => useForm<IniziativaFormData>({
    resolver: zodResolver(iniziativaSchema),
    defaultValues: DEFAULT_FORM_VALUES
  }));

  const [editForm] = useState(() => useForm<IniziativaFormData>({
    resolver: zodResolver(iniziativaSchema),
    defaultValues: DEFAULT_FORM_VALUES
  }));

  const resetCreateForm = () => {
    createForm.reset(DEFAULT_FORM_VALUES);
  };

  return {
    createForm,
    editForm,
    resetCreateForm
  };
};
