import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OpinioniDialogData } from "../types";
import { getFieldName } from "../utils/candidatoUtils";
import { useQueryClient } from "@tanstack/react-query";

export const useCandidatiActions = (user: any, categoria: string, fcmToken: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selezionando, setSelezionando] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);

  const selezionaCandidato = async (candidatoId: string, onSuccess: (id: string) => void) => {
    if (!user) return;
    
    console.log('🔍 DEBUG - user object:', user);
    console.log('🔍 DEBUG - user.uid:', user.uid);
    console.log('🔍 DEBUG - user.id:', user.id);
    
    setSelezionando(true);
    try {
      // Usa user.id invece di user.uid se uid è undefined
      const userId = user.uid || user.id;
      console.log('🔍 DEBUG - userId finale:', userId);
      
      const fieldName = getFieldName(categoria);
      console.log('🔍 DEBUG - fieldName:', fieldName);
      
      const response = await apiRequest("POST", "/api/users/update-candidato", {
        userId: userId,
        fieldName: fieldName,
        candidatoId: candidatoId,
        fcmToken: fcmToken
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nella selezione del candidato");
      }

      const result = await response.json();
      
      if (result.success) {
        onSuccess(candidatoId);
        toast({
          title: "Successo",
          description: "Candidato selezionato con successo!",
        });
        
        // Invalida la cache per aggiornare i dati
        queryClient.invalidateQueries({ queryKey: ['elezioniData'] });
        queryClient.invalidateQueries({ queryKey: ['candidati', categoria] });
      } else {
        throw new Error(result.error || "Errore nella selezione del candidato");
      }

    } catch (error) {
      console.error("Errore durante la selezione del candidato:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nella selezione del candidato",
        variant: "destructive",
      });
    } finally {
      setSelezionando(false);
    }
  };

  const openOpinioniDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => {
    setOpinioniDialogData({ utenteId, nome, cognome, avatarConfig });
  };

  const closeOpinioniDialog = () => {
    setOpinioniDialogData(null);
  };

  return {
    selezionando,
    opinioniDialogData,
    selezionaCandidato,
    openOpinioniDialog,
    closeOpinioniDialog
  };
};
