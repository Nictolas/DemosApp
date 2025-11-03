import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IniziativePopolariData, Classifica } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useIniziativeVoting = (data: IniziativePopolariData | undefined) => {
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
    mutationFn: async (voti: string[]) => {
      console.log('🔍 DEBUG Frontend - saveVotiMutation.mutate chiamata');
      console.log('🔍 DEBUG Frontend - Voti da inviare:', voti);
      console.log('🔍 DEBUG Frontend - Tipo voti:', typeof voti, Array.isArray(voti));
      console.log('🔍 DEBUG Frontend - Dati iniziative disponibili:', data?.iniziative?.map(i => ({ id: i.id, nome: i.nome })));
      
      try {
        const response = await apiRequest("POST", "/api/iniziative-popolari/vota", { voti });
        console.log('🔍 DEBUG Frontend - Risposta API ricevuta:', response);
        return response;
      } catch (error) {
        console.error('❌ DEBUG Frontend - Errore nella chiamata API:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('✅ DEBUG Frontend - saveVotiMutation.onSuccess chiamato');
      const remainingVotes = getRemainingVotes('iniziative_popolari', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `Le tue preferenze per le iniziative popolari sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['iniziativePopolariData'] });
    },
    onError: (error: any) => {
      console.error('❌ DEBUG Frontend - saveVotiMutation.onError:', error);
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare le preferenze.", 
        variant: "destructive" 
      });
    },
    onSettled: () => {
      console.log('🔍 DEBUG Frontend - saveVotiMutation.onSettled chiamato');
    }
  });

  // Logica locale per gestire i voti
  const toggleSelezione = (id: string) => {
    if (saveVotiMutation.isPending || data?.blocco?.isBlocked) return;
    
    // Accedi allo stato corrente per decidere l'azione
    setSelectedVoti(prev => {
      // Se l'iniziativa è già selezionata, rimuovila (non salva, solo rimuove localmente)
      if (prev.includes(id)) {
        return prev.filter(n => n !== id);
      }
      
      // Verifica se l'utente ha già votato (controlla data?.mieiVoti)
      const haGiaVotato = (data?.mieiVoti || []).length > 0;
      const currentVotes = prev.length;
      const limit = getVotingLimit('iniziative_popolari');
      
      // Se l'utente sta aggiungendo un voto e ha già raggiunto il limite locale
      if (hasReachedVotingLimit('iniziative_popolari', currentVotes)) {
        // Trova il nome dell'iniziativa già votata
        const currentVotedId = prev[0];
        const currentVotedIniziativa = data?.iniziative.find(i => i.id === currentVotedId);
        const newIniziativa = data?.iniziative.find(i => i.id === id);
        
        const currentVotedName = currentVotedIniziativa?.nome || 'l\'iniziativa selezionata';
        const newIniziativaName = newIniziativa?.nome || 'questa iniziativa';
        
        // Messaggio diverso se ha già votato (deve includere info sulla settimana)
        let messaggioConfirm;
        if (haGiaVotato) {
          messaggioConfirm = `Hai votato: ${currentVotedName}.\n\nSicuro di voler cambiare voto?\n\nDopo aver salvato, potrai modificare le preferenze solo tra una settimana.`;
        } else {
          messaggioConfirm = `Vuoi votare per: ${newIniziativaName}?\n\nDopo aver salvato, potrai modificare le preferenze solo tra una settimana.`;
        }
        
        // Mostra alert di conferma sincrono
        const confirmed = window.confirm(messaggioConfirm);
        
        if (confirmed) {
          // L'utente ha confermato, sostituisci il voto
          const nuoviVoti = [id];
          // Salva fuori dalla callback per evitare problemi di sincronizzazione
          setTimeout(() => {
            console.log('🔍 DEBUG - Salvataggio automatico dopo cambio voto:', nuoviVoti);
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return nuoviVoti;
        } else {
          // L'utente ha annullato, mantieni il voto corrente
          return prev;
        }
      }
      
      // Se è il primo voto (non ha ancora votato e sta aggiungendo)
      if (!haGiaVotato && currentVotes === 0) {
        const newIniziativa = data?.iniziative.find(i => i.id === id);
        const newIniziativaName = newIniziativa?.nome || 'questa iniziativa';
        
        // Mostra alert di conferma per il primo voto
        const messaggioConfirm = `Vuoi votare per: ${newIniziativaName}?\n\nDopo aver salvato, potrai modificare le preferenze solo tra una settimana.`;
        const confirmed = window.confirm(messaggioConfirm);
        
        if (confirmed) {
          // L'utente ha confermato, aggiungi il voto
          const nuoviVoti = [...prev, id];
          // Salva fuori dalla callback per evitare problemi di sincronizzazione
          setTimeout(() => {
            console.log('🔍 DEBUG - Salvataggio automatico primo voto:', nuoviVoti);
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return nuoviVoti;
        } else {
          // L'utente ha annullato, non aggiungere il voto
          return prev;
        }
      }
      
      // Caso normale: aggiungi il voto senza salvare (non dovrebbe arrivare qui con limite 1)
      return [...prev, id];
    });
  };

  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    const iniziativa = data?.iniziative.find(i => i.nome === nome);
    if (iniziativa) {
      toggleSelezione(iniziativa.id);
    }
  };

  // Calcola se i voti sono cambiati (non più usato dopo rimozione pulsante Salva, ma lasciato per compatibilità)
  const votiCambiati = useMemo(() => {
    const selectedSorted = [...selectedVoti].sort();
    const savedSorted = [...(data?.mieiVoti || [])].sort();
    const changed = JSON.stringify(selectedSorted) !== JSON.stringify(savedSorted);
    console.log('🔍 DEBUG useIniziativeVoting - votiCambiati calcolato:', {
      selectedVoti: selectedSorted,
      mieiVoti: savedSorted,
      changed
    });
    return changed;
  }, [selectedVoti, data?.mieiVoti]);

  // Calcola la classifica ottimistica (aggiornata immediatamente con i cambiamenti locali)
  const classificaOttimistica = useMemo(() => {
    // Se non ci sono dati, usa la classifica originale se disponibile
    if (!data?.iniziative) {
      return data?.classifica || [];
    }

    // Se non c'è classifica ma ci sono iniziative, crea una classifica vuota con tutte le iniziative ufficiali
    if (!data?.classifica || data.classifica.length === 0) {
      const iniziativeUfficiali = data.iniziative
        .filter(i => i.quorum !== 'proposta')
        .map(iniziativa => ({
          nome: iniziativa.nome,
          sitoWeb: iniziativa.sitoWeb,
          voti: 0
        }));
      
      // Applica i cambiamenti locali anche qui
      const classificaMap = new Map<string, { voti: number; sitoWeb?: string }>();
      iniziativeUfficiali.forEach(item => {
        classificaMap.set(item.nome, { voti: item.voti, sitoWeb: item.sitoWeb });
      });

      // Trova le iniziative aggiunte (in selectedVoti ma non in mieiVoti)
      const iniziativeAggiunte = selectedVoti.filter(id => !(data?.mieiVoti || []).includes(id));
      
      // Trova le iniziative rimosse (in mieiVoti ma non in selectedVoti)
      const iniziativeRimosse = (data?.mieiVoti || []).filter(id => !selectedVoti.includes(id));

      // Incrementa i voti per le iniziative aggiunte
      iniziativeAggiunte.forEach(id => {
        const iniziativa = data.iniziative.find(i => i.id === id);
        if (iniziativa) {
          const current = classificaMap.get(iniziativa.nome) || { voti: 0, sitoWeb: iniziativa.sitoWeb };
          classificaMap.set(iniziativa.nome, {
            voti: current.voti + 1,
            sitoWeb: current.sitoWeb || iniziativa.sitoWeb
          });
        }
      });

      // Decrementa i voti per le iniziative rimosse
      iniziativeRimosse.forEach(id => {
        const iniziativa = data.iniziative.find(i => i.id === id);
        if (iniziativa) {
          const current = classificaMap.get(iniziativa.nome) || { voti: 0, sitoWeb: iniziativa.sitoWeb };
          classificaMap.set(iniziativa.nome, {
            voti: Math.max(0, current.voti - 1),
            sitoWeb: current.sitoWeb || iniziativa.sitoWeb
          });
        }
      });

      return Array.from(classificaMap.entries())
        .map(([nome, { voti, sitoWeb }]) => ({
          nome,
          sitoWeb,
          voti
        }))
        .sort((a, b) => {
          if (b.voti !== a.voti) {
            return b.voti - a.voti;
          }
          return a.nome.localeCompare(b.nome);
        });
    }

    // Crea una mappa della classifica originale (nome -> {voti, sitoWeb})
    const classificaMap = new Map<string, { voti: number; sitoWeb?: string }>();
    data.classifica.forEach(item => {
      classificaMap.set(item.nome, { voti: item.voti, sitoWeb: item.sitoWeb });
    });

    // Aggiungi anche tutte le iniziative ufficiali (quorum != 'proposta') che potrebbero non essere in classifica
    data.iniziative
      .filter(i => i.quorum !== 'proposta')
      .forEach(iniziativa => {
        if (!classificaMap.has(iniziativa.nome)) {
          classificaMap.set(iniziativa.nome, { voti: 0, sitoWeb: iniziativa.sitoWeb });
        }
      });

    // Trova le iniziative aggiunte (in selectedVoti ma non in mieiVoti)
    const iniziativeAggiunte = selectedVoti.filter(id => !(data?.mieiVoti || []).includes(id));
    
    // Trova le iniziative rimosse (in mieiVoti ma non in selectedVoti)
    const iniziativeRimosse = (data?.mieiVoti || []).filter(id => !selectedVoti.includes(id));

    // Incrementa i voti per le iniziative aggiunte
    iniziativeAggiunte.forEach(id => {
      const iniziativa = data.iniziative.find(i => i.id === id);
      if (iniziativa) {
        const current = classificaMap.get(iniziativa.nome) || { voti: 0, sitoWeb: iniziativa.sitoWeb };
        classificaMap.set(iniziativa.nome, {
          voti: current.voti + 1,
          sitoWeb: current.sitoWeb || iniziativa.sitoWeb
        });
      }
    });

    // Decrementa i voti per le iniziative rimosse
    iniziativeRimosse.forEach(id => {
      const iniziativa = data.iniziative.find(i => i.id === id);
      if (iniziativa) {
        const current = classificaMap.get(iniziativa.nome) || { voti: 0, sitoWeb: iniziativa.sitoWeb };
        classificaMap.set(iniziativa.nome, {
          voti: Math.max(0, current.voti - 1),
          sitoWeb: current.sitoWeb || iniziativa.sitoWeb
        });
      }
    });

    // Converti la mappa in array - MOSTRA TUTTE le iniziative ufficiali, anche con 0 voti
    const classificaAggiornata: Classifica[] = Array.from(classificaMap.entries())
      .map(([nome, { voti, sitoWeb }]) => ({
        nome,
        sitoWeb,
        voti
      }))
      .sort((a, b) => {
        // Ordina per voti decrescenti, poi per nome crescente
        if (b.voti !== a.voti) {
          return b.voti - a.voti;
        }
        return a.nome.localeCompare(b.nome);
      });

    return classificaAggiornata;
  }, [data?.classifica, data?.iniziative, selectedVoti, data?.mieiVoti]);

  // Informazioni sui limiti di voto
  const currentVotes = selectedVoti.length;
  const limit = getVotingLimit('iniziative_popolari');
  const remainingVotes = getRemainingVotes('iniziative_popolari', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('iniziative_popolari', currentVotes);

  return {
    selectedVoti,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    // Classifica ottimistica aggiornata
    classificaOttimistica,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
