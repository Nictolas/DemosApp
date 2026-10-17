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

  const selectionErrorDescription = (error: any) => {
    const apiCode = error?.data?.code || error?.data?.error || "";
    const apiMessage = error?.data?.message || error?.message || "";

    if (apiCode === "CIVIC_IDENTITY_CIE_REQUIRED") {
      return "Per effettuare questa scelta devi prima verificare la tua identità con CIE.";
    }
    if (apiCode === "CIVIC_IDENTITY_CHECK_UNAVAILABLE") {
      return "La verifica dell'identità è temporaneamente non disponibile. Riprova tra poco.";
    }
    if (apiCode === "OPINIONI_INCOMPLETE" || apiMessage.includes("OPINIONI_INCOMPLETE")) {
      return "Completa tutte le opinioni di questo livello prima di scegliere.";
    }
    if (apiCode === "CANDIDATO_NON_VOTABILE" || apiMessage.includes("CANDIDATO_NON_VOTABILE")) {
      return "Questo candidato non è selezionabile nella tua circoscrizione.";
    }
    if (apiCode === "RAPPRESENTANTE_NON_SELEZIONABILE" || apiMessage.includes("RAPPRESENTANTE_NON_SELEZIONABILE")) {
      return "Questo rappresentante non è selezionabile per il tuo territorio.";
    }
    if (error?.status === 401) {
      return "Sessione non valida o scaduta. Accedi di nuovo e riprova.";
    }
    if (error?.status === 403) {
      return apiMessage || "Non sei autorizzato a effettuare questa scelta.";
    }

    return isCandidateRoute
      ? "Impossibile selezionare il candidato."
      : "Impossibile selezionare il rappresentante.";
  };

  const selezionaRappresentante = async (rappresentanteId: string, onSuccess: (id: string) => void) => {
    if (!user) return;

    setSelezionando(true);
    const userId = user.uid || user.id;

    // Solo questa chiamata determina se la selezione è riuscita o no. Le attività
    // successive (cache e notifiche push) non devono trasformare un salvataggio
    // riuscito in un falso messaggio di errore.
    try {
      await apiRequest(
        "PUT",
        `/api/users/${userId}/seleziona-rappresentante`,
        {
          campo: getFieldName(categoria, isCandidateRoute),
          rappresentanteId,
        }
      );
    } catch (error: any) {
      console.error("Errore durante il salvataggio della selezione:", error);
      toast({
        title: "Errore",
        description: selectionErrorDescription(error),
        variant: "destructive",
      });
      setSelezionando(false);
      return;
    }

    onSuccess(rappresentanteId);

    try {
      if (isCandidateRoute) {
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ["candidatiData"] }),
          queryClient.invalidateQueries({ queryKey: ["rappresentantiData"] }),
          queryClient.invalidateQueries({ queryKey: ["user"] }),
        ]);
        await queryClient.refetchQueries({ queryKey: ["candidatiData"] });
      } else {
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ["rappresentantiData"] }),
          queryClient.invalidateQueries({ queryKey: ["rappresentantiData", "rappresentanti"] }),
          queryClient.invalidateQueries({ queryKey: ["user"] }),
        ]);
        await queryClient.refetchQueries({ queryKey: ["rappresentantiData"] });
      }
    } catch (error) {
      console.warn("Selezione salvata, ma aggiornamento cache non completato:", error);
    }

    if (fcmToken && !isCandidateRoute) {
      try {
        const topic = `sostenitori_politico_${rappresentanteId}`;
        await apiRequest("POST", "/api/notifications/subscribe-topic", { token: fcmToken, topic });
      } catch (error) {
        console.warn("Rappresentante salvato, ma iscrizione notifiche non completata:", error);
      }
    }

    toast({
      title: "Successo",
      description: isCandidateRoute
        ? "Candidato selezionato con successo!"
        : "Rappresentante selezionato con successo!",
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    setLocation(isCandidateRoute ? "/candidati" : "/rappresentanti");
    setSelezionando(false);
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
