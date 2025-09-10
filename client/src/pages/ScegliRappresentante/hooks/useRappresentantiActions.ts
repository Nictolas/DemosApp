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
  
  // Detect if the current route is under /test
  const [isTestRoute] = useRoute("/test/:categoria");

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
        await queryClient.invalidateQueries({ queryKey: ['rappresentantiData', 'test'] });
        await queryClient.invalidateQueries({ queryKey: ['rappresentantiData'] });
        await queryClient.invalidateQueries({ queryKey: ['user'] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['rappresentantiData', 'rappresentanti'] });
        await queryClient.invalidateQueries({ queryKey: ['user'] });
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

      // Reindirizza automaticamente a /test dopo la selezione in modalità test
      if (isTestRoute) {
        console.log('🔄 DEBUG - Reindirizzamento a /test dopo selezione candidato');
        setTimeout(() => {
          setLocation('/test');
        }, 1000); // Piccolo delay per permettere al toast di essere visibile
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
    setOpinioniDialogData(data);
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
