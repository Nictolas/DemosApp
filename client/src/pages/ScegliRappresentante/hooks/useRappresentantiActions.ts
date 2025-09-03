import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OpinioniDialogData } from "../types";
import { getFieldName } from "../utils/rappresentanteUtils";
import { useQueryClient } from "@tanstack/react-query";

export const useRappresentantiActions = (user: any, categoria: string, fcmToken: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selezionando, setSelezionando] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);

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
          campo: getFieldName(categoria),
          rappresentanteId: rappresentanteId,
        }
      );

      if (!updateResponse.ok) {
        throw new Error("Impossibile aggiornare la selezione.");
      }
      
      onSuccess(rappresentanteId);

      // Invalida la query dei rappresentanti per aggiornare la pagina rappresentanti
      await queryClient.invalidateQueries({ queryKey: ['rappresentantiData'] });

      // Gestione FCM
      if (fcmToken) {
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
        description: "Rappresentante selezionato con successo!",
      });

    } catch (error) {
      console.error("Errore durante la selezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile selezionare il rappresentante.",
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
