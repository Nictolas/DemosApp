import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { comunicaSchema, ComunicaFormData } from "../schemas";
import { ExistingComunicazione, ComunicazioneData } from "../types";

export const useComunicaForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [existingComunicazione, setExistingComunicazione] = useState<ExistingComunicazione | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: {
      titolo: "",
      voto_dato: undefined,
      commento: "",
      vincitore: undefined,
    },
  });

  // Generate zona based on user location
  const generateZona = () => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    if (isMobile) {
      return "Mobile";
    }
    
    return "Zona non specificata";
  };

  // Check for existing comunicazione
  const checkDuplicate = async (titolo: string) => {
    if (!titolo.trim()) return;
    
    setCheckingDuplicate(true);
    try {
      const zona = generateZona();
      const response = await apiRequest("GET", `/api/comunicazioni/check-duplicate?titolo=${encodeURIComponent(titolo)}&zona=${encodeURIComponent(zona)}`);
      const data = await response.json();
      
      if (data.exists) {
        setExistingComunicazione(data.comunicazione);
        form.setValue("vincitore", data.comunicazione.vincitore);
      } else {
        setExistingComunicazione(null);
      }
    } catch (error) {
      console.error("Errore nel controllo duplicati:", error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Submit comunicazione
  const submitComunicazione = useMutation({
    mutationFn: async (data: ComunicaFormData) => {
      const zona = generateZona();
      const comunicazioneData: ComunicazioneData = {
        ...data,
        zona,
        isDuplicate: !!existingComunicazione,
      };
      
      const response = await apiRequest("POST", "/api/comunicazioni", comunicazioneData);
      
      if (!response.ok) {
        throw new Error("Errore nell'invio della comunicazione");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comunicazione inviata",
        description: "La tua comunicazione è stata registrata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["ultimaComunicazione"] });
      setLocation("/preferiti");
    },
    onError: (error) => {
      console.error("Errore nell'invio:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio della comunicazione.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComunicaFormData) => {
    submitComunicazione.mutate(data);
  };

  return {
    form,
    existingComunicazione,
    checkingDuplicate,
    checkDuplicate,
    onSubmit,
    submitComunicazione,
  };
};
