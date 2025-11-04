import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { OpinioneProposta } from "../types";
import { useToast } from "@/hooks/use-toast";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useProponiOpinioneData = (user: any) => {
  const { toast } = useToast();
  const [opinioni, setOpinioni] = useState<OpinioneProposta[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userVoti, setUserVoti] = useState<string[]>([]);

  // Carica opinioni proposte e voti utente dall'API Neon
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      console.log('🔍 Caricamento opinioni proposte...');
      const data = await apiRequest('GET', '/api/opinioni-proposte');
      console.log('📊 Dati ricevuti:', data);
      
      if (data.success && data.data) {
        const opinioniMapped = data.data.map((op: any) => ({
          id: op.id,
          testo: op.testo,
          voti: op.voti || 0,
          proponente: op.nome && op.cognome ? `${op.nome} ${op.cognome}` : op.email || 'Utente',
          titolo: op.titolo,
          descrizione: op.descrizione,
          categoria: op.categoria,
          data_creazione: op.data_creazione
        }));
        
        // Ordina le opinioni per numero di voti decrescente (più votate in alto)
        const opinioniOrdinate = opinioniMapped.sort((a, b) => b.voti - a.voti);
        
        setOpinioni(opinioniOrdinate);
        
        // Carica i voti dell'utente
        console.log('🔍 Caricamento voti utente...');
        try {
          const votiData = await apiRequest('GET', '/api/opinioni-proposte/voti-utente');
          setUserVoti(votiData.data || []);
          console.log('✅ Voti utente caricati:', votiData.data);
        } catch (error) {
          console.log('⚠️ Errore nel caricare voti utente:', error);
          setUserVoti([]);
        }
        
        console.log(`✅ Caricate ${opinioniMapped.length} opinioni proposte`);
      } else {
        console.log('⚠️ Nessuna opinione proposta trovata');
        setOpinioni([]);
        setUserVoti([]);
      }
    } catch (error) {
      console.error('❌ Errore nel caricamento opinioni proposte:', error);
      toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: "destructive" });
      setOpinioni([]);
      setUserVoti([]);
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  // Proponi nuova opinione tramite API Neon
  const handleProponi = async (testoInput: string) => {
    if (!testoInput.trim()) return false;
    
    try {
      console.log('📝 Invio nuova opinione proposta...');
      const data = await apiRequest('POST', '/api/opinioni-proposte', {
        testo: testoInput.trim()
      });
      
      console.log('✅ Opinione proposta inviata:', data);
      
      toast({ 
        title: "Successo", 
        description: "La tua opinione è stata proposta con successo!" 
      });
      
      // Ricarica i dati per mostrare la nuova opinione
      await loadData();
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'invio proposta:', error);
      toast({ 
        title: "Errore", 
        description: error instanceof Error ? error.message : "Errore nell'invio della proposta", 
        variant: "destructive" 
      });
      return false;
    }
  };

  // Vota opinione tramite API Neon
  const handleVota = async (id: string) => {
    if (userVoti.includes(id)) {
      toast({ title: "Voto già registrato", description: "Hai già votato questa opinione." });
      return false;
    }
    
    // Controlla il limite di voti per opinioni proposte
    const currentVotes = userVoti.length;
    const limit = getVotingLimit('opinioni_proposte');
    
    if (hasReachedVotingLimit('opinioni_proposte', currentVotes)) {
      toast({ 
        title: "Limite voti raggiunto", 
        description: `Puoi votare al massimo ${limit} opinioni proposte. Rimuovi un voto esistente per votarne una nuova.`,
        variant: "destructive"
      });
      return false;
    }
    
    try {
      console.log('👍 Invio voto per opinione:', id);
      await apiRequest('POST', `/api/opinioni-proposte/${id}/vota`);
      
      console.log('✅ Voto registrato con successo');
      
      // Aggiorna immediatamente i voti dell'utente
      setUserVoti(prev => [...prev, id]);
      
      const remainingVotes = getRemainingVotes('opinioni_proposte', currentVotes + 1);
      toast({ 
        title: "Successo", 
        description: `Il tuo voto è stato registrato! Voti rimanenti: ${remainingVotes}` 
      });
      
      // Ricarica i dati per aggiornare i voti
      await loadData();
      return true;
    } catch (error) {
      console.error('❌ Errore nel voto:', error);
      toast({ 
        title: "Errore", 
        description: error instanceof Error ? error.message : "Errore nel voto", 
        variant: "destructive" 
      });
      return false;
    }
  };

  // TODO: Migrate from Firebase to Neon API
  // Salva batch con dialog di conferma
  const handleSalvaVoti = async (selectedVoti: string[]) => {
    try {
      // TODO: Implement Neon API call
      // Calcola differenze
      // const daAggiungere = selectedVoti.filter(n => !userVoti.includes(n));
      // const daRimuovere = userVoti.filter(n => !selectedVoti.includes(n));
      
      // Aggiungi nuovi voti
      // for (const id of daAggiungere) {
      //   const ref = doc(db, "opinioni_proposte", id);
      //   await updateDoc(ref, {
      //     votanti: arrayUnion(user.uid),
      //     voti: increment(1),
      //   });
      // }
      
      // Rimuovi voti tolti
      // for (const id of daRimuovere) {
      //   const ref = doc(db, "opinioni_proposte", id);
      //   await updateDoc(ref, {
      //     votanti: arrayRemove(user.uid),
      //     voti: increment(-1),
      //   });
      // }
      
      // Aggiorna lastProponiOpinioneEdit
      // const userDocRef = doc(db, "utenti", user.uid);
      // await updateDoc(userDocRef, { lastProponiOpinioneEdit: new Date().toISOString() });
      
      toast({ title: "Funzionalità temporaneamente non disponibile", description: "La migrazione è in corso." });
      // loadData();
      return false;
    } catch (error) {
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  // Rimuovi voto da un'opinione
  const handleRimuoviVoto = async (id: string) => {
    if (!userVoti.includes(id)) {
      toast({ title: "Voto non trovato", description: "Non hai votato questa opinione." });
      return false;
    }
    
    try {
      console.log('👎 Rimozione voto per opinione:', id);
      await apiRequest('DELETE', `/api/opinioni-proposte/${id}/vota`);
      
      console.log('✅ Voto rimosso con successo');
      
      // Aggiorna immediatamente i voti dell'utente
      setUserVoti(prev => prev.filter(votoId => votoId !== id));
      
      const remainingVotes = getRemainingVotes('opinioni_proposte', userVoti.length - 1);
      toast({ 
        title: "Successo", 
        description: `Il tuo voto è stato rimosso! Voti rimanenti: ${remainingVotes}` 
      });
      
      // Ricarica i dati per aggiornare i voti
      await loadData();
      return true;
    } catch (error) {
      console.error('❌ Errore nella rimozione voto:', error);
      toast({ 
        title: "Errore", 
        description: error instanceof Error ? error.message : "Errore nella rimozione del voto", 
        variant: "destructive" 
      });
      return false;
    }
  };

  // Cancella opinione proposta (solo admin)
  const handleCancella = async (id: string) => {
    if (!user || user.role !== 'AD') {
      toast({ 
        title: "Non autorizzato", 
        description: "Solo gli amministratori possono cancellare opinioni.", 
        variant: "destructive" 
      });
      return false;
    }
    
    try {
      console.log('🗑️ Cancellazione opinione proposta:', id);
      await apiRequest('DELETE', `/api/opinioni-proposte/${id}`);
      
      console.log('✅ Opinione cancellata con successo');
      
      toast({ 
        title: "Successo", 
        description: "Opinione cancellata con successo" 
      });
      
      // Ricarica i dati per rimuovere l'opinione dalla lista
      await loadData();
      return true;
    } catch (error) {
      console.error('❌ Errore nella cancellazione opinione:', error);
      toast({ 
        title: "Errore", 
        description: error instanceof Error ? error.message : "Errore nella cancellazione dell'opinione", 
        variant: "destructive" 
      });
      return false;
    }
  };

  return {
    opinioni,
    loadingData,
    userVoti,
    loadData,
    handleProponi,
    handleVota,
    handleRimuoviVoto,
    handleSalvaVoti,
    handleCancella
  };
};
