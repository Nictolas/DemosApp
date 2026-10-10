import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { comunicaSchema, ComunicaFormData } from "../schemas";
import { ComunicazioneData } from "../types";

export const useComunicaForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: {
      titolo: "",
      data_votazione: new Date().toISOString().slice(0, 10),
      voto_dato: undefined,
      commento: "",
    },
  });

  const submitComunicazione = useMutation({
    mutationFn: async (data: ComunicaFormData) => {
      const comunicazioneData: ComunicazioneData = { ...data };
      const response = await apiRequest(
        "POST",
        "/api/comunicazioni",
        comunicazioneData,
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Errore nell'invio della comunicazione");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Voto comunicato",
        description: "Il voto istituzionale è stato registrato.",
      });
      queryClient.invalidateQueries({ queryKey: ["ultimaComunicazione"] });
      setLocation("/menu");
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComunicaFormData) => {
    submitComunicazione.mutate(data);
  };

  return {
    form,
    onSubmit,
    submitComunicazione,
  };
};
