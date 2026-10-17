import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OpinioniDialogData } from "../types";
import { getFieldName } from "../utils/rappresentanteUtils";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export const useRappresentantiActions = (user: any, categoria: string, fcmToken: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selezionando, setSelezionando] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);
  const [location, setLocation] = useLocation();

  // La stessa UI viene usata per candidati e rappresentanti: la route è la fonte
  // canonica della modalità, senza dipendere da useRoute annidati.
  const isCandidateRoute = location === "/candidati" || location.startsWith("/candidati/");

  const selezionaRappresentante = async (rappresentanteId: string, onSuccess: (id: string) => void) => {
    if (!user) return;

    setSelezionando(true);
    try {
      const userId = user.uid || user.id;

      await apiRequest(
        "PUT",
        `/api/users/${userId}/seleziona-rappresentante`,
        {
          campo: getFieldName(categoria, isCandidateRoute),
          rappresentanteId,
        }
      );

      onSuccess(rappresentanteId);

      if (isCandidateRoute) {
        await queryClient.invalidateQueries({ queryKey: ["candidatiData"] });
        await queryClient.invalidateQueries({ queryKey: ["rappresentantiData"] });
        await queryClient.invalidateQueries({ queryKey: ["user"] });
        await queryClient.refetchQueries({ queryKey: ["candidatiData"] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["rappresentantiData"] });
        await queryClient.invalidateQueries({ queryKey: ["rappresentantiData", "rappresentanti"] });
        await queryClient.invalidateQueries({ queryKey: ["user"] });
        await queryClient.refetchQueries({ queryKey: ["rappresentantiData"] });
      }

      if (fcmToken && !isCandidateRoute) {
        const topic = `sostenitori_politico_${rappresentanteId}`;
        await apiRequest("POST", "/api/notifications/subscribe-topic", { token: fcmToken, topic });
      }

      toast({
        title: "Successo",
        description: isCandidateRoute
          ? "Candidato selezionato con successo!"
          : "Rappresentante selezionato con successo!",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      setLocation(isCandidateRoute ? "/candidati" : "/rappresentanti");
    } catch (error: any) {
      console.error("Errore durante la selezione:", error);

      const apiCode = error?.data?.code || error?.data?.error || "";
      const apiMessage = error?.data?.message || error?.message || "";

      let description = isCandidateRoute
        ? "Impossibile selezionare il candidato."
        : "Impossibile selezionare il rappresentante.";

      if (apiCode === "CIVIC_IDENTITY_CIE_REQUIRED") {
        description = "Per effettuare questa scelta devi prima verificare la tua identità con CIE.";
      } else if (apiCode === "OPINIONI_INCOMPLETE" || apiMessage.includes("OPINIONI_INCOMPLETE")) {
        description = "Completa tutte le opinioni di questo livello prima di scegliere.";
      } else if (apiCode === "CANDIDATO_NON_VOTABILE" || apiMessage.includes("CANDIDATO_NON_VOTABILE")) {
        description = "Questo candidato non è selezionabile nella tua circoscrizione.";
      } else if (apiCode === "RAPPRESENTANTE_NON_SELEZIONABILE" || apiMessage.includes("RAPPRESENTANTE_NON_SELEZIONABILE")) {
        description = "Questo rappresentante non è selezionabile per il tuo territorio.";
      } else if (error?.status === 401) {
        description = "Sessione non valida o scaduta. Accedi di nuovo e riprova.";
      } else if (error?.status === 403) {
        description = apiMessage || "Non sei autorizzato a effettuare questa scelta.";
      }

      toast({
        title: "Errore",
        description,
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
    closeOpinioniDialog,
  };
};
