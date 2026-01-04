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
    if (data?.mieiVoti !== undefined) {
      // Aggiorna sempre selectedVoti quando mieiVoti è disponibile (anche se vuoto)
      setSelectedVoti(data.mieiVoti);
    }
  }, [data?.mieiVoti]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      console.log('🔍 DEBUG Frontend - saveVotiMutation.mutate chiamata per referendum');
      console.log('🔍 DEBUG Frontend - Voti da inviare:', voti);
      try {
        const response = await apiRequest("POST", "/api/referendum-abrogativi/vota", { voti });
        console.log('🔍 DEBUG Frontend - Risposta API ricevuta:', response);
        return response;
      } catch (error) {
        console.error('❌ DEBUG Frontend - Errore nella chiamata API:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('✅ DEBUG Frontend - saveVotiMutation.onSuccess chiamato per referendum');
      const remainingVotes = getRemainingVotes('referendum_abrogativi', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `Le tue preferenze per i referendum abrogativi sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['referendumAbrogativiData'] });
    },
    onError: (error: any) => {
      console.error('❌ DEBUG Frontend - saveVotiMutation.onError per referendum:', error);
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
      // Se il referendum è già selezionato, rimuovilo (non salva, solo rimuove localmente)
      if (prev.includes(referendumId)) {
        return prev.filter(id => id !== referendumId);
      }
      
      // Verifica se l'utente ha già votato (controlla data?.mieiVoti)
      const haGiaVotato = (data?.mieiVoti || []).length > 0;
      const currentVotes = prev.length;
      const limit = getVotingLimit('referendum_abrogativi');
      
      // Se l'utente sta aggiungendo un voto e ha già raggiunto il limite locale
      if (hasReachedVotingLimit('referendum_abrogativi', currentVotes)) {
        // Trova il nome del referendum già votato
        const currentVotedId = prev[0];
        const currentVotedReferendum = data?.referendum.find(r => r.id === currentVotedId);
        const newReferendum = data?.referendum.find(r => r.id === referendumId);
        
        const currentVotedName = currentVotedReferendum?.nome || 'il referendum selezionato';
        const newReferendumName = newReferendum?.nome || 'questo referendum';
        
        // Messaggio diverso se ha già votato (deve includere info sulla settimana)
        let messaggioConfirm;
        if (haGiaVotato) {
          messaggioConfirm = `Hai votato: ${currentVotedName}.\n\nSicuro di voler cambiare voto?\n\nDopo aver salvato, potrai modificare le preferenze solo tra una settimana.`;
        } else {
          messaggioConfirm = `Vuoi votare per: ${newReferendumName}?\n\nDopo aver salvato, potrai modificare le preferenze solo tra una settimana.`;
        }
        
        // Mostra alert di conferma sincrono
        const confirmed = window.confirm(messaggioConfirm);
        
        if (confirmed) {
          // L'utente ha confermato, sostituisci il voto
          const nuoviVoti = [referendumId];
          // Salva fuori dalla callback per evitare problemi di sincronizzazione
          setTimeout(() => {
            console.log('🔍 DEBUG - Salvataggio automatico dopo cambio voto referendum:', nuoviVoti);
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
        const newReferendum = data?.referendum.find(r => r.id === referendumId);
        const newReferendumName = newReferendum?.nome || 'questo referendum';
        
        // Mostra alert di conferma per il primo voto
        const messaggioConfirm = `Vuoi votare per: ${newReferendumName}?\n\nDopo aver salvato, potrai modificare le preferenze solo tra una settimana.`;
        const confirmed = window.confirm(messaggioConfirm);
        
        if (confirmed) {
          // L'utente ha confermato, aggiungi il voto
          const nuoviVoti = [...prev, referendumId];
          // Salva fuori dalla callback per evitare problemi di sincronizzazione
          setTimeout(() => {
            console.log('🔍 DEBUG - Salvataggio automatico primo voto referendum:', nuoviVoti);
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return nuoviVoti;
        } else {
          // L'utente ha annullato, non aggiungere il voto
          return prev;
        }
      }
      
      // Caso normale: aggiungi il voto senza salvare (non dovrebbe arrivare qui con limite 1)
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
          emoji: ref.emoji,
          voti: 0
        }));
      
      // Applica i cambiamenti locali anche qui
      const classificaMap = new Map<string, { voti: number; emoji?: string }>();
      referendumUfficiali.forEach(item => {
        classificaMap.set(item.nome, { voti: item.voti, emoji: item.emoji });
      });

      // Trova i referendum aggiunti (in selectedVoti ma non in mieiVoti)
      const referendumAggiunti = selectedVoti.filter(id => !(data?.mieiVoti || []).includes(id));
      
      // Trova i referendum rimossi (in mieiVoti ma non in selectedVoti)
      const referendumRimossi = (data?.mieiVoti || []).filter(id => !selectedVoti.includes(id));

      // Incrementa i voti per i referendum aggiunti
      referendumAggiunti.forEach(id => {
        const referendum = data.referendum.find(r => r.id === id);
        if (referendum) {
          const current = classificaMap.get(referendum.nome) || { voti: 0, emoji: referendum.emoji };
          classificaMap.set(referendum.nome, {
            voti: current.voti + 1,
            emoji: current.emoji || referendum.emoji
          });
        }
      });

      // Decrementa i voti per i referendum rimossi
      referendumRimossi.forEach(id => {
        const referendum = data.referendum.find(r => r.id === id);
        if (referendum) {
          const current = classificaMap.get(referendum.nome) || { voti: 0, emoji: referendum.emoji };
          classificaMap.set(referendum.nome, {
            voti: Math.max(0, current.voti - 1),
            emoji: current.emoji || referendum.emoji
          });
        }
      });

      return Array.from(classificaMap.entries())
        .map(([nome, { voti, emoji }]) => ({
          nome,
          emoji,
          voti
        }))
        .sort((a, b) => {
          if (b.voti !== a.voti) {
            return b.voti - a.voti;
          }
          return a.nome.localeCompare(b.nome);
        });
    }

    // Crea una mappa della classifica originale (nome -> {voti, emoji})
    const classificaMap = new Map<string, { voti: number; emoji?: string }>();
    data.classifica.forEach(item => {
      classificaMap.set(item.nome, { voti: item.voti, emoji: item.emoji });
    });

    // Aggiungi anche tutti i referendum ufficiali (quorum != 'proposta') che potrebbero non essere in classifica
    data.referendum
      .filter(r => r.quorum !== 'proposta')
      .forEach(ref => {
        if (!classificaMap.has(ref.nome)) {
          classificaMap.set(ref.nome, { voti: 0, emoji: ref.emoji });
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
        const current = classificaMap.get(referendum.nome) || { voti: 0, emoji: referendum.emoji };
        classificaMap.set(referendum.nome, {
          voti: current.voti + 1,
          emoji: current.emoji || referendum.emoji
        });
      }
    });

    // Decrementa i voti per i referendum rimossi
    referendumRimossi.forEach(id => {
      const referendum = data.referendum.find(r => r.id === id);
      if (referendum) {
        const current = classificaMap.get(referendum.nome) || { voti: 0, emoji: referendum.emoji };
        classificaMap.set(referendum.nome, {
          voti: Math.max(0, current.voti - 1),
          emoji: current.emoji || referendum.emoji
        });
      }
    });

    // Converti la mappa in array - MOSTRA TUTTI i referendum ufficiali, anche con 0 voti
    const classificaAggiornata: Classifica[] = Array.from(classificaMap.entries())
      .map(([nome, { voti, emoji }]) => ({
        nome,
        emoji,
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
