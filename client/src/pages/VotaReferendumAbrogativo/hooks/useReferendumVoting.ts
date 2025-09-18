import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReferendumAbrogativiData } from "../types";

export const useReferendumVoting = (data: ReferendumAbrogativiData | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setSelectedVoti(data.mieiVoti);
    }
  }, [data]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/referendum-abrogativi/vota", { voti }),
    onSuccess: () => {
      toast({ 
        title: "Preferenze salvate", 
        description: "Le tue preferenze per i referendum abrogativi sono state aggiornate." 
      });
      queryClient.invalidateQueries({ queryKey: ['referendumAbrogativiData'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare le preferenze.", 
        variant: "destructive" 
      });
    }
  });

  // Logica locale per gestire i voti
  const toggleSelezione = (referendumId: string) => {
    if (saveVotiMutation.isPending || data?.blocco?.isBlocked) return;
    setSelectedVoti(prev => 
      prev.includes(referendumId) 
        ? prev.filter(id => id !== referendumId)
        : [...prev, referendumId]
    );
  };

  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco?.isBlocked) return;
    const referendum = data?.referendum.find(r => r.nome === nome);
    if (referendum) {
      toggleSelezione(referendum.id);
    }
  };

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  return {
    selectedVoti,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    votiCambiati
  };
};
