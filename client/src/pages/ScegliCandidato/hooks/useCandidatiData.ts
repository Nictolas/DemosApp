import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Candidato, OpinioniDialogData } from "../types";
import { getTitolo, getFieldName } from "../utils/candidatoUtils";

export const useCandidatiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const [candidati, setCandidati] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidatoSelezionato, setCandidatoSelezionato] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const grado = getTitolo(categoria);
        const url = `/api/candidati/disponibili?grado=${encodeURIComponent(grado)}&categoria=${encodeURIComponent(categoria || '')}`;
        
        console.log('🔍 DEBUG Frontend Candidati - Chiamata API:', url);
        console.log('🔍 DEBUG Frontend Candidati - Categoria:', categoria);
        console.log('🔍 DEBUG Frontend Candidati - Grado:', grado);
        
        const response = await apiRequest("GET", url);

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati dal server.");
        }
        
        const result = await response.json();
        
        console.log('🔍 DEBUG Frontend Candidati - Risposta API:', result);
        
        if (!result.success) {
          throw new Error(result.error || "Errore nel caricamento dei dati");
        }
        
        const { candidati, utente } = result.data;
        
        console.log('🔍 DEBUG Frontend Candidati - Candidati ricevuti:', candidati?.length || 0);
        console.log('🔍 DEBUG Frontend Candidati - Utente:', utente);
        
        setCandidatoSelezionato(utente[getFieldName(categoria)] || null);
        setCandidati(candidati || []);

      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i candidati.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, categoria, toast]);

  return {
    candidati,
    loading,
    candidatoSelezionato,
    setCandidatoSelezionato
  };
};