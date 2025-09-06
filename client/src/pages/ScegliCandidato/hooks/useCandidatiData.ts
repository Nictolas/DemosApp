import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Candidato } from "../types";
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
        const url = `/api/elezioni-utente/disponibili?grado=${encodeURIComponent(grado)}&categoria=${encodeURIComponent(categoria || '')}`;
        
        console.log('🔍 DEBUG Frontend - Chiamata API:', url);
        console.log('🔍 DEBUG Frontend - Categoria:', categoria);
        console.log('🔍 DEBUG Frontend - Grado:', grado);
        
        const response = await apiRequest("GET", url);

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati dal server.");
        }
        
        const result = await response.json();
        
        console.log('🔍 DEBUG Frontend - Risposta API:', result);
        
        if (!result.success) {
          throw new Error(result.error || "Errore nel caricamento dei dati");
        }
        
        const { candidati: candidatiData, utente } = result.data;
        
        console.log('🔍 DEBUG Frontend - Candidati ricevuti:', candidatiData?.length || 0);
        console.log('🔍 DEBUG Frontend - Utente:', utente);
        
        setCandidatoSelezionato(utente[getFieldName(categoria)] || null);
        setCandidati(candidatiData || []);

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
