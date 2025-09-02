import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OpinioneProposta } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useProponiOpinioneData = (user: any) => {
  const { toast } = useToast();
  const [opinioni, setOpinioni] = useState<OpinioneProposta[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userVoti, setUserVoti] = useState<string[]>([]);

  // Carica opinioni proposte e voti utente direttamente da Firestore
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const snap = await getDocs(collection(db, "opinioni_proposte"));
      const arr = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setOpinioni(arr.map(op => ({
        id: op.id,
        testo: op.testo,
        voti: op.voti || 0,
        proponente: op.proponente || "",
        votanti: op.votanti || [],
      })));
      const mieiVoti = arr.filter(op => (op.votanti || []).includes(user.uid)).map(op => op.id);
      setUserVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  // Proponi nuova opinione direttamente su Firestore
  const handleProponi = async (testoInput: string) => {
    if (!testoInput.trim()) return;
    try {
      await addDoc(collection(db, "opinioni_proposte"), {
        testo: testoInput.trim(),
        voti: 0,
        proponente: user.uid,
        proponente_email: user.email,
        data_creazione: new Date().toISOString(),
        votanti: [],
      });
      toast({ title: "Opinione proposta!", description: "La tua proposta sarà valutata dall'admin." });
      loadData();
      return true;
    } catch (error) {
      toast({ title: "Errore", description: "Errore nell'invio della proposta", variant: "destructive" });
      return false;
    }
  };

  // Vota opinione direttamente su Firestore
  const handleVota = async (id: string) => {
    if (userVoti.includes(id)) {
      toast({ title: "Voto già registrato", description: "Hai già votato questa opinione." });
      return false;
    }
    try {
      const ref = doc(db, "opinioni_proposte", id);
      await updateDoc(ref, {
        votanti: arrayUnion(user.uid),
        voti: increment(1),
      });
      toast({ title: "Voto registrato", description: "Hai votato questa opinione." });
      loadData();
      return true;
    } catch (error) {
      toast({ title: "Errore", description: "Errore nel voto", variant: "destructive" });
      return false;
    }
  };

  // Salva batch con dialog di conferma
  const handleSalvaVoti = async (selectedVoti: string[]) => {
    try {
      // Calcola differenze
      const daAggiungere = selectedVoti.filter(n => !userVoti.includes(n));
      const daRimuovere = userVoti.filter(n => !selectedVoti.includes(n));
      
      // Aggiungi nuovi voti
      for (const id of daAggiungere) {
        const ref = doc(db, "opinioni_proposte", id);
        await updateDoc(ref, {
          votanti: arrayUnion(user.uid),
          voti: increment(1),
        });
      }
      
      // Rimuovi voti tolti
      for (const id of daRimuovere) {
        const ref = doc(db, "opinioni_proposte", id);
        await updateDoc(ref, {
          votanti: arrayRemove(user.uid),
          voti: increment(-1),
        });
      }
      
      // Aggiorna lastProponiOpinioneEdit
      const userDocRef = doc(db, "utenti", user.uid);
      await updateDoc(userDocRef, { lastProponiOpinioneEdit: new Date().toISOString() });
      
      toast({ title: "Preferenze salvate", description: "Le tue preferenze sono state aggiornate." });
      loadData();
      return true;
    } catch (error) {
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  return {
    opinioni,
    loadingData,
    userVoti,
    loadData,
    handleProponi,
    handleVota,
    handleSalvaVoti
  };
};
