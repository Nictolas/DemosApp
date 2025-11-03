import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReferendumAbrogativiData, Classifica } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

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
      const remainingVotes = getRemainingVotes('referendum_abrogativi', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `Le tue preferenze per i referendum abrogativi sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
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
    
    setSelectedVoti(prev => {
      // Se il referendum è già selezionato, rimuovilo
      if (prev.includes(referendumId)) {
        return prev.filter(id => id !== referendumId);
      }
      
      // Se l'utente ha già votato e prova a votare un altro referendum, mostra alert di conferma
      const currentVotes = prev.length;
      const limit = getVotingLimit('referendum_abrogativi');
      
      if (hasReachedVotingLimit('referendum_abrogativi', currentVotes)) {
        // Trova il nome del referendum già votato
        const currentVotedId = prev[0];
        const currentVotedReferendum = data?.referendum.find(r => r.id === currentVotedId);
        
        const currentVotedName = currentVotedReferendum?.nome || 'il referendum selezionato';
        
        // Mostra alert di conferma sincrono (blocca l'esecuzione finché l'utente non risponde)
        // Salva i valori necessari prima dell'alert
        const newId = referendumId;
        const shouldConfirm = () => {
          const confirmed = window.confirm(
            `Hai votato: ${currentVotedName}.\n\nSicuro di voler cambiare voto?`
          );
          return confirmed;
        };
        
        // Esegui la conferma immediatamente (prima del return)
        // Usiamo una funzione immediatamente invocata per gestire l'alert sincrono
        if (shouldConfirm()) {
          // L'utente ha confermato, sostituisci il voto
          return [newId];
        } else {
          // L'utente ha annullato, mantieni il voto corrente
          return prev;
        }
      }
      
      // Aggiungi il voto
      return [...prev, referendumId];
    });
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

  // Calcola la classifica ottimistica (aggiornata immediatamente con i cambiamenti locali)
  const classificaOttimistica = useMemo(() => {
    // Se non ci sono dati, usa la classifica originale se disponibile
    if (!data?.referendum) {
      return data?.classifica || [];
    }

    // Se non c'è classifica ma ci sono referendum, crea una classifica vuota con tutti i referendum ufficiali
    if (!data?.classifica || data.classifica.length === 0) {
      const referendumUfficiali = data.referendum
        .filter(r => r.quorum !== 'proposta')
        .map(ref => ({
          nome: ref.nome,
          voti: 0
        }));
      
      // Applica i cambiamenti locali anche qui
      const classificaMap = new Map<string, number>();
      referendumUfficiali.forEach(item => {
        classificaMap.set(item.nome, item.voti);
      });

      // Trova i referendum aggiunti (in selectedVoti ma non in mieiVoti)
      const referendumAggiunti = selectedVoti.filter(id => !(data?.mieiVoti || []).includes(id));
      
      // Trova i referendum rimossi (in mieiVoti ma non in selectedVoti)
      const referendumRimossi = (data?.mieiVoti || []).filter(id => !selectedVoti.includes(id));

      // Incrementa i voti per i referendum aggiunti
      referendumAggiunti.forEach(id => {
        const referendum = data.referendum.find(r => r.id === id);
        if (referendum) {
          const current = classificaMap.get(referendum.nome) || 0;
          classificaMap.set(referendum.nome, current + 1);
        }
      });

      // Decrementa i voti per i referendum rimossi
      referendumRimossi.forEach(id => {
        const referendum = data.referendum.find(r => r.id === id);
        if (referendum) {
          const current = classificaMap.get(referendum.nome) || 0;
          classificaMap.set(referendum.nome, Math.max(0, current - 1));
        }
      });

      return Array.from(classificaMap.entries())
        .map(([nome, voti]) => ({
          nome,
          voti
        }))
        .sort((a, b) => {
          if (b.voti !== a.voti) {
            return b.voti - a.voti;
          }
          return a.nome.localeCompare(b.nome);
        });
    }

    // Crea una mappa della classifica originale (nome -> voti)
    const classificaMap = new Map<string, number>();
    data.classifica.forEach(item => {
      classificaMap.set(item.nome, item.voti);
    });

    // Aggiungi anche tutti i referendum ufficiali (quorum != 'proposta') che potrebbero non essere in classifica
    data.referendum
      .filter(r => r.quorum !== 'proposta')
      .forEach(ref => {
        if (!classificaMap.has(ref.nome)) {
          classificaMap.set(ref.nome, 0);
        }
      });

    // Trova i referendum aggiunti (in selectedVoti ma non in mieiVoti)
    const referendumAggiunti = selectedVoti.filter(id => !(data?.mieiVoti || []).includes(id));
    
    // Trova i referendum rimossi (in mieiVoti ma non in selectedVoti)
    const referendumRimossi = (data?.mieiVoti || []).filter(id => !selectedVoti.includes(id));

    // Incrementa i voti per i referendum aggiunti
    referendumAggiunti.forEach(id => {
      const referendum = data.referendum.find(r => r.id === id);
      if (referendum) {
        const current = classificaMap.get(referendum.nome) || 0;
        classificaMap.set(referendum.nome, current + 1);
      }
    });

    // Decrementa i voti per i referendum rimossi
    referendumRimossi.forEach(id => {
      const referendum = data.referendum.find(r => r.id === id);
      if (referendum) {
        const current = classificaMap.get(referendum.nome) || 0;
        classificaMap.set(referendum.nome, Math.max(0, current - 1));
      }
    });

    // Converti la mappa in array - MOSTRA TUTTI i referendum ufficiali, anche con 0 voti
    const classificaAggiornata: Classifica[] = Array.from(classificaMap.entries())
      .map(([nome, voti]) => ({
        nome,
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
  }, [data?.classifica, data?.referendum, selectedVoti, data?.mieiVoti]);

  // Informazioni sui limiti di voto
  const currentVotes = selectedVoti.length;
  const limit = getVotingLimit('referendum_abrogativi');
  const remainingVotes = getRemainingVotes('referendum_abrogativi', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('referendum_abrogativi', currentVotes);

  return {
    selectedVoti,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    votiCambiati,
    // Classifica ottimistica aggiornata
    classificaOttimistica,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
