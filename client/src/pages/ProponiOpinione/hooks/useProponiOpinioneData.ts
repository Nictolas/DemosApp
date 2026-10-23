import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { OpinioneProposta } from "../types";
import { useToast } from "@/hooks/use-toast";
import { hasReachedVotingLimit } from "@/config/votingLimits";

export const useProponiOpinioneData = (user: any) => {
  const { toast } = useToast();
  const [opinioni, setOpinioni] = useState<OpinioneProposta[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [haGiaProposto, setHaGiaProposto] = useState(false);
  const [votiVerificati, setVotiVerificati] = useState(false);
  const [votiError, setVotiError] = useState<string | null>(null);
  const [votingPending, setVotingPending] = useState(false);
  const voteInFlight = useRef(false);

  // Non mostrare mai 0/1 come fallback se la lettura dei voti non funziona.
  // Un errore di rete/auth deve bloccare il voto e rendere visibile il retry.
  const loadData = useCallback(async (): Promise<string[] | null> => {
    if (!user) return null;
    setLoadingData(true);
    setVotiVerificati(false);
    setVotiError(null);
    try {
      const res = await apiRequest('GET', '/api/opinioni-proposte');
      const body = res?.data;
      if (body?.success !== true || !Array.isArray(body.data)) {
        throw new Error('Impossibile caricare le opinioni proposte.');
      }

      const opinioniMapped = body.data.map((op: any) => ({
        id: String(op.id),
        testo: op.testo,
        voti: Number(op.voti) || 0,
        proponente: op.proponente || 'Utente',
        titolo: op.titolo,
        descrizione: op.descrizione,
        categoria: op.categoria,
        data_creazione: op.data_creazione
      }));
      setOpinioni(opinioniMapped.sort((a, b) => b.voti - a.voti));
      setHaGiaProposto(body.ha_gia_proposto === true);

      const votiRes = await apiRequest('GET', '/api/opinioni-proposte/voti-utente');
      const votiBody = votiRes?.data;
      if (votiBody?.success !== true || !Array.isArray(votiBody.data)) {
        throw new Error('Impossibile verificare i voti già registrati.');
      }

      const voti = votiBody.data.map((id: unknown) => String(id));
      setUserVoti(voti);
      setVotiVerificati(true);
      return voti;
    } catch (error) {
      console.error('Errore nel caricamento dei voti delle proposte:', error);
      setVotiError('Non è stato possibile verificare i tuoi voti. Riprova per poter votare.');
      return null;
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  // Proponi nuova opinione tramite API (max 1 per utente)
  const handleProponi = async (testoInput: string) => {
    if (haGiaProposto) {
      toast({ title: "Limite raggiunto", description: "Hai già proposto un'opinione. Puoi proporne solo una.", variant: "destructive" });
      return false;
    }
    if (!testoInput.trim()) return false;
    
    // Verifica se l'opinione esiste già localmente prima di inviare
    const testoNormalizzato = testoInput.trim().toLowerCase();
    const esisteGià = opinioni.some(op => op.testo.toLowerCase() === testoNormalizzato);
    
    if (esisteGià) {
      toast({ 
        title: "Opinione già esistente", 
        description: "Questa opinione è già stata proposta.", 
        variant: "destructive" 
      });
      return false;
    }
    
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
      
      setHaGiaProposto(true); // limite 1: non può proporne altre
      await loadData();
      return true;
    } catch (error: any) {
      console.error('❌ Errore nell\'invio proposta:', error);
      if (error?.status === 403 || error?.data?.error?.includes('già proposto')) {
        setHaGiaProposto(true);
        toast({ title: "Limite raggiunto", description: "Hai già proposto un'opinione. Puoi proporne solo una.", variant: "destructive" });
      } else {
        toast({ 
          title: "Errore", 
          description: error instanceof Error ? error.message : "Errore nell'invio della proposta", 
          variant: "destructive" 
        });
      }
      return false;
    }
  };

  // Un ref blocca i tocchi rapidi prima del successivo render di React.
  const handleVota = async (id: string) => {
    if (voteInFlight.current) return false;
    if (!votiVerificati) {
      toast({ title: 'Voti non verificati', description: 'Ricarica i voti prima di procedere.', variant: 'destructive' });
      return false;
    }
    if (userVoti.includes(id)) {
      toast({ title: 'Voto già registrato', description: 'Hai già votato questa opinione.' });
      return false;
    }
    if (hasReachedVotingLimit('opinioni_proposte', userVoti.length)) {
      toast({ title: 'Limite raggiunto', description: 'Rimuovi il voto attuale prima di sceglierne un altro.', variant: 'destructive' });
      return false;
    }

    voteInFlight.current = true;
    setVotingPending(true);
    try {
      const response = await apiRequest('POST', `/api/opinioni-proposte/${encodeURIComponent(id)}/vota`);
      if (response?.data?.success !== true) throw new Error('Il server non ha confermato il voto.');
      const votiConfermati = await loadData();
      if (!votiConfermati?.includes(id)) {
        toast({ title: 'Verifica necessaria', description: 'Il server ha risposto, ma non è stato possibile confermare il voto. Ricarica i voti.', variant: 'destructive' });
        return false;
      }
      toast({ title: 'Successo', description: 'Il tuo voto è stato registrato!' });
      return true;
    } catch (error) {
      console.error('Errore registrazione voto:', error);
      const message = error instanceof Error ? error.message : 'Errore nel voto';
      toast({ title: 'Voto non confermato', description: message, variant: 'destructive' });
      // Dopo un errore, anche un 409 per dati obsoleti, riallinea lo stato reale.
      await loadData();
      return false;
    } finally {
      voteInFlight.current = false;
      setVotingPending(false);
    }
  };

  // TODO: collegare endpoint API dedicato
  // Salva batch con dialog di conferma
  const handleSalvaVoti = async (selectedVoti: string[]) => {
    try {
      // TODO: Implement API call
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

  // Rimozione: conferma l'assenza del voto dopo l'ACK del backend.
  const handleRimuoviVoto = async (id: string) => {
    if (voteInFlight.current || !votiVerificati || !userVoti.includes(id)) return false;
    voteInFlight.current = true;
    setVotingPending(true);
    try {
      const response = await apiRequest('DELETE', `/api/opinioni-proposte/${encodeURIComponent(id)}/vota`);
      if (response?.data?.success !== true) throw new Error('Il server non ha confermato la rimozione.');
      const votiConfermati = await loadData();
      if (!votiConfermati || votiConfermati.includes(id)) {
        toast({ title: 'Verifica necessaria', description: 'Non è stato possibile confermare la rimozione. Ricarica i voti.', variant: 'destructive' });
        return false;
      }
      toast({ title: 'Successo', description: 'Il tuo voto è stato rimosso.' });
      return true;
    } catch (error) {
      console.error('Errore rimozione voto:', error);
      toast({ title: 'Errore', description: error instanceof Error ? error.message : 'Errore nella rimozione', variant: 'destructive' });
      await loadData();
      return false;
    } finally {
      voteInFlight.current = false;
      setVotingPending(false);
    }
  };

  // Cancella opinione proposta (solo admin)
  const handleCancella = async (id: string) => {
    if (!user || user.ruolo !== 'AD') {
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
    haGiaProposto,
    votiVerificati,
    votiError,
    votingPending,
    loadData,
    handleProponi,
    handleVota,
    handleRimuoviVoto,
    handleSalvaVoti,
    handleCancella
  };
};
