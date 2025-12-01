import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CapoStatoData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useCapoStatoVoting = (data: CapoStatoData | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data && Array.isArray(data.mieiVoti)) {
      // Aggiorna sempre selectedVoti quando mieiVoti è disponibile (anche se vuoto)
      setSelectedVoti(data.mieiVoti);
    } else if (!data) {
      // Se data non è ancora caricato, resetta selectedVoti
      setSelectedVoti([]);
    }
  }, [data]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      console.log('🔍 DEBUG CLIENT - Tentativo di salvataggio voti:', voti);
      console.log('🔍 DEBUG CLIENT - Tipo voti:', typeof voti, Array.isArray(voti));
      console.log('🔍 DEBUG CLIENT - Token presente:', !!localStorage.getItem('auth_token'));
      
      try {
        const response = await apiRequest("POST", "/api/capo-stato/vota", { voti });
        console.log('✅ DEBUG CLIENT - Risposta ricevuta:', response);
        console.log('✅ DEBUG CLIENT - Response ok:', response?.ok);
        console.log('✅ DEBUG CLIENT - Response data:', response?.data);
        
        if (!response?.ok) {
          throw new Error(response?.data?.error || 'Errore nel salvataggio');
        }
        
        return response;
      } catch (error: any) {
        console.error('❌ DEBUG CLIENT - Errore nella richiesta:', error);
        console.error('❌ DEBUG CLIENT - Error message:', error.message);
        console.error('❌ DEBUG CLIENT - Error status:', error.status);
        console.error('❌ DEBUG CLIENT - Error stack:', error.stack);
        throw error;
      }
    },
    onSuccess: () => {
      const remainingVotes = getRemainingVotes('capo_stato', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `I tuoi voti sono stati aggiornati. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['capoStatoData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare i voti.", variant: "destructive" });
    },
    onSettled: () => {
      // Dialog rimosso, salvataggio automatico
    }
  });

  // Logica locale per aggiungere/rimuovere voti dalla selezione temporanea
  const handleAddNomeLocal = (nome: string) => {
    if (selectedVoti.includes(nome)) {
      toast({ title: "Voto già selezionato", description: `Hai già selezionato ${nome}` });
      return;
    }
    
    // Controlla il limite di voti massimi
    const limit = getVotingLimit('capo_stato');
    const haGiaVotato = (data?.mieiVoti || []).length > 0;
    
    if (hasReachedVotingLimit('capo_stato', selectedVoti.length)) {
      // Se ha già votato, sostituisci il voto e salva automaticamente
      const nuoviVoti = [nome];
      setSelectedVoti(nuoviVoti);
      // Salva automaticamente dopo aver aggiornato lo stato
      setTimeout(() => {
        saveVotiMutation.mutate(nuoviVoti);
      }, 0);
      return;
    }
    
    // Se non ha raggiunto il limite, aggiungi il voto e salva automaticamente
    const nuoviVoti = [...selectedVoti, nome];
    setSelectedVoti(nuoviVoti);
    // Salva automaticamente dopo aver aggiornato lo stato
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };

  const handleRemoveLocal = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    const nuoviVoti = selectedVoti.filter(n => n !== nome);
    setSelectedVoti(nuoviVoti);
    // Salva automaticamente dopo aver rimosso il voto
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };
  
  const toggleSelezione = (nome: string) => {
    console.log('🔍 DEBUG CLIENT - toggleSelezione chiamato con nome:', nome);
    console.log('🔍 DEBUG CLIENT - isPending:', saveVotiMutation.isPending);
    console.log('🔍 DEBUG CLIENT - isBlocked:', data?.blocco.isBlocked);
    
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) {
      console.log('⚠️ DEBUG CLIENT - toggleSelezione bloccato (isPending o isBlocked)');
      return;
    }
    
    setSelectedVoti(prev => {
      console.log('🔍 DEBUG CLIENT - selectedVoti precedente:', prev);
      
      if (prev.includes(nome)) {
        // Rimuovi il voto e salva automaticamente
        const nuoviVoti = prev.filter(n => n !== nome);
        console.log('🔍 DEBUG CLIENT - Rimozione voto, nuovi voti:', nuoviVoti);
        setTimeout(() => {
          console.log('🔍 DEBUG CLIENT - Chiamata saveVotiMutation.mutate per rimozione');
          saveVotiMutation.mutate(nuoviVoti);
        }, 0);
        return nuoviVoti;
      } else {
        // Se l'utente ha già votato e prova a votare qualcun altro, sostituisci e salva
        const limit = getVotingLimit('capo_stato');
        
        if (hasReachedVotingLimit('capo_stato', prev.length)) {
          // Sostituisci il voto esistente con il nuovo e salva automaticamente
          const nuoviVoti = [nome];
          console.log('🔍 DEBUG CLIENT - Sostituzione voto (limite raggiunto), nuovi voti:', nuoviVoti);
          setTimeout(() => {
            console.log('🔍 DEBUG CLIENT - Chiamata saveVotiMutation.mutate per sostituzione');
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return nuoviVoti;
        } else {
          // Primo voto o aggiunta normale, salva automaticamente
          const nuoviVoti = [...prev, nome];
          console.log('🔍 DEBUG CLIENT - Aggiunta voto, nuovi voti:', nuoviVoti);
          setTimeout(() => {
            console.log('🔍 DEBUG CLIENT - Chiamata saveVotiMutation.mutate per aggiunta');
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return nuoviVoti;
        }
      }
    });
  };

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  // Informazioni sui limiti di voto
  const currentVotes = selectedVoti.length;
  const limit = getVotingLimit('capo_stato');
  const remainingVotes = getRemainingVotes('capo_stato', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('capo_stato', currentVotes);

  return {
    selectedVoti,
    saveVotiMutation,
    handleAddNomeLocal,
    handleRemoveLocal,
    toggleSelezione,
    votiCambiati,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
