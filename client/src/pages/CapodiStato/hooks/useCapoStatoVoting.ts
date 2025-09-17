import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { useToast } from "@/hooks/use-toast";
import { CapoStatoData } from "../types";

export const useCapoStatoVoting = (data: CapoStatoData | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setSelectedVoti(data.mieiVoti);
    }
  }, [data]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/capo-stato/vota", { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "I tuoi voti sono stati aggiornati." });
      queryClient.invalidateQueries({ queryKey: ['capoStatoData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare i voti.", variant: "destructive" });
    },
    onSettled: () => {
      setShowConfirmDialog(false);
    }
  });

  // Logica locale per aggiungere/rimuovere voti dalla selezione temporanea
  const handleAddNomeLocal = (nome: string) => {
    if (selectedVoti.includes(nome)) {
      toast({ title: "Voto già selezionato", description: `Hai già selezionato ${nome}` });
      return;
    }
    setSelectedVoti(prev => [...prev, nome]);
  };

  const handleRemoveLocal = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev => prev.filter(n => n !== nome));
  };
  
  const toggleSelezione = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]);
  };

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify(selectedVoti.sort()) !== JSON.stringify(data?.mieiVoti.sort() || []);

  return {
    selectedVoti,
    showConfirmDialog,
    setShowConfirmDialog,
    saveVotiMutation,
    handleAddNomeLocal,
    handleRemoveLocal,
    toggleSelezione,
    votiCambiati
  };
};
