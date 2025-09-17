import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import apiRequest from "@/lib/api-request";
import { elezioneSchema, ElezioneForm } from "../schemas";
import { Elezione } from "../types";

export const useElezioneForm = (onSuccess: () => void) => {
  const { toast } = useToast();
  const [editingElezione, setEditingElezione] = useState<Elezione | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ElezioneForm>({
    resolver: zodResolver(elezioneSchema),
    defaultValues: {
      tipo: "stato",
      zona: "",
      datainizio: "",
      datafine: "",
      circa: true,
    },
  });

  const resetForm = () => {
    form.reset();
    setEditingElezione(null);
  };

  const handleSubmit = async (data: ElezioneForm) => {
    setSubmitting(true);
    try {
      let response;
      if (editingElezione) {
        // 2. Aggiorna un'elezione esistente tramite API
        response = await apiRequest("PUT", `/api/elezioni/${editingElezione.id}`, data);
      } else {
        // 3. Crea una nuova elezione tramite API
        response = await apiRequest("POST", "/api/elezioni", data);
      }

      if (!response.ok) throw new Error("Salvataggio fallito.");

      toast({ title: "Successo", description: `Elezione ${editingElezione ? 'aggiornata' : 'creata'} con successo` });
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('❌ DEBUG: Errore nel salvataggio:', error);
      toast({ title: "Errore", description: "Impossibile salvare l'elezione", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (elezione: Elezione) => {
    setEditingElezione(elezione);
    form.reset({
      tipo: elezione.tipo as any || "stato",
      zona: elezione.zona || "",
      datainizio: elezione.datainizio || "",
      datafine: elezione.datafine || "",
      circa: elezione.circa || true
    });
  };

  return {
    form,
    editingElezione,
    submitting,
    handleSubmit,
    handleEdit,
    resetForm,
  };
};
