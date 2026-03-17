import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OpinioniDialogData } from "../types";
import { getFieldName } from "../utils/candidatoUtils";
import { useLocation } from "wouter";

export const useCandidatiActions = (user: any, categoria: string, fcmToken: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selezionando, setSelezionando] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);
  const [, setLocation] = useLocation();

  const selezionaCandidato = async (candidatoId: string, onSuccess: (id: string) => void) => {
    if (!user) return;
    
    console.log('🔍 DEBUG - user object:', user);
    console.log('🔍 DEBUG - user.id:', user.id);
    
    setSelezionando(true);
    try {
      // Usa user.id invece di user.uid se uid è undefined
      const userId = user.uid || user.id;
      console.log('🔍 DEBUG - userId da usare:', userId);
      
      const updateResponse = await apiRequest(
        "PUT",
        `/api/candidati/seleziona-candidato`,
        {
          campo: getFieldName(categoria),
          candidatoId: candidatoId,
        }
      );

      if (!updateResponse.ok) {
        throw new Error("Impossibile aggiornare la selezione.");
      }
      
      onSuccess(candidatoId);

      // Invalida le query appropriate
      console.log('🔄 DEBUG - Invalidando query per candidati');
      await queryClient.invalidateQueries({ queryKey: ['candidatiData'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      await queryClient.invalidateQueries({ queryKey: ['candidati/selezioni'] });
      // Forza il refetch immediato
      await queryClient.refetchQueries({ queryKey: ['candidatiData'] });

      toast({
        title: "Successo",
        description: "Candidato selezionato con successo!",
      });

      // Reindirizza automaticamente dopo la selezione
      console.log('🔄 DEBUG - Reindirizzamento a /candidati dopo selezione candidato');
      setLocation('/candidati');

    } catch (error) {
      console.error("Errore durante la selezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile selezionare il candidato.",
        variant: "destructive",
      });
    } finally {
      setSelezionando(false);
    }
  };

  const openOpinioniDialog = (data: OpinioniDialogData) => {
    setOpinioniDialogData(data);
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
