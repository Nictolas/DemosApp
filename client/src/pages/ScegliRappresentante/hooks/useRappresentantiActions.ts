import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OpinioniDialogData } from "../types";
import { getFieldName } from "../utils/rappresentanteUtils";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";

export const useRappresentantiActions = (user: any, categoria: string, fcmToken: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selezionando, setSelezionando] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);
  const [, setLocation] = useLocation();
  
  // Detect if the current route is under /candidati
  const [isTestRoute] = useRoute("/candidati/:categoria");

  const selezionaRappresentante = async (rappresentanteId: string, onSuccess: (id: string) => void) => {
    if (!user) return;
    
    console.log('🔍 DEBUG - user object:', user);
    console.log('🔍 DEBUG - user.uid:', user.uid);
    console.log('🔍 DEBUG - user.id:', user.id);
    
    setSelezionando(true);
    try {
      // Usa user.id invece di user.uid se uid è undefined
      const userId = user.uid || user.id;
      console.log('🔍 DEBUG - userId da usare:', userId);
      
      const updateResponse = await apiRequest(
        "PUT",
        `/api/users/${userId}/seleziona-rappresentante`,
        {
          campo: getFieldName(categoria, isTestRoute),
          rappresentanteId: rappresentanteId,
        }
      );

      if (!updateResponse.ok) {
        throw new Error("Impossibile aggiornare la selezione.");
      }
      
      onSuccess(rappresentanteId);

      // Invalida le query appropriate in base alla modalità
      if (isTestRoute) {
        console.log('🔄 DEBUG - Invalidando query per modalità test');
        await queryClient.invalidateQueries({ queryKey: ['candidatiData'] });
        await queryClient.invalidateQueries({ queryKey: ['rappresentantiData'] });
        await queryClient.invalidateQueries({ queryKey: ['user'] });
        // Forza il refetch immediato
        await queryClient.refetchQueries({ queryKey: ['candidatiData'] });
      } else {
        console.log('🔄 DEBUG - Invalidando query per modalità rappresentanti');
        // Invalida tutte le varianti della query key per essere sicuri
        await queryClient.invalidateQueries({ queryKey: ['rappresentantiData'] });
        await queryClient.invalidateQueries({ queryKey: ['rappresentantiData', 'rappresentanti'] });
        await queryClient.invalidateQueries({ queryKey: ['user'] });
        // Forza il refetch immediato prima della navigazione
        await queryClient.refetchQueries({ queryKey: ['rappresentantiData'] });
      }

      // Gestione FCM (solo per rappresentanti, non per test)
      if (fcmToken && !isTestRoute) {
        const topic = `sostenitori_politico_${rappresentanteId}`;
        await apiRequest(
            "POST",
            "/api/notifications/subscribe-topic",
            { token: fcmToken, topic }
        );
        toast({
            title: "Notifiche attivate",
            description: `Riceverai notifiche push per questo rappresentante.`,
            variant: "success"
        });
      }

      toast({
        title: "Successo",
        description: isTestRoute ? "Candidato selezionato con successo!" : "Rappresentante selezionato con successo!",
      });

      // Piccolo delay per assicurarsi che il refetch sia completato prima della navigazione
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reindirizza automaticamente dopo la selezione
      if (isTestRoute) {
        console.log('🔄 DEBUG - Reindirizzamento a /candidati dopo selezione candidato');
        setLocation('/candidati');
      } else {
        console.log('🔄 DEBUG - Reindirizzamento a /rappresentanti dopo selezione rappresentante');
        setLocation('/rappresentanti');
      }

    } catch (error) {
      console.error("Errore durante la selezione:", error);
      toast({
        title: "Errore",
        description: isTestRoute ? "Impossibile selezionare il candidato." : "Impossibile selezionare il rappresentante.",
        variant: "destructive",
      });
    } finally {
      setSelezionando(false);
    }
  };

  const openOpinioniDialog = (data: OpinioniDialogData) => {
    console.log('🔍 DEBUG useRappresentantiActions - openOpinioniDialog chiamato con data:', data);
    setOpinioniDialogData(data);
    console.log('🔍 DEBUG useRappresentantiActions - opinioniDialogData impostato a:', data);
  };

  const closeOpinioniDialog = () => {
    setOpinioniDialogData(null);
  };

  return {
    selezionando,
    opinioniDialogData,
    selezionaRappresentante,
    openOpinioniDialog,
    closeOpinioniDialog
  };
};
