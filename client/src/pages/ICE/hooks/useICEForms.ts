import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ICEFormData } from "../types";
import { iceSchema, DEFAULT_FORM_VALUES } from "../constants/schema";

export const useICEForms = () => {
  const createForm = useForm<ICEFormData>({
    resolver: zodResolver(iceSchema),
    defaultValues: DEFAULT_FORM_VALUES
  });

  const editForm = useForm<ICEFormData>({
    resolver: zodResolver(iceSchema)
  });

  const resetCreateForm = () => createForm.reset(DEFAULT_FORM_VALUES);

  return {
    createForm,
    editForm,
    resetCreateForm
  };
};
