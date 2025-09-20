import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Rappresentante, OpinioniDialogData } from "../types";
import { getTitolo, getFieldName } from "../utils/rappresentanteUtils";
import { useRoute } from "wouter";

export const useRappresentantiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const [rappresentanti, setRappresentanti] = useState<Rappresentante[]>([]);
  const [loading, setLoading] = useState(true);
  const [rappresentanteSelezionato, setRappresentanteSelezionato] = useState<string | null>(null);
  
  // Detect if the current route is under /candidati
  const [isTestRoute] = useRoute("/candidati/:categoria");

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        let url = '';
        if (isTestRoute) {
          // Use the new API endpoint for test routes (candidati)
          // Mappa la categoria al grado_candidatura corretto
          const gradoCandidatura = getTitolo(categoria);
          url = `/api/candidati/disponibili?grado_candidatura=${encodeURIComponent(gradoCandidatura)}`;
          console.log('🔍 DEBUG Frontend - Chiamata API CANDIDATI:', url);
          console.log('🔍 DEBUG Frontend - Categoria mappata:', categoria, '->', gradoCandidatura);
        } else {
          // Use the existing API endpoint for regular rappresentanti routes
          const grado = getTitolo(categoria);
          url = `/api/rappresentanti/disponibili?grado=${encodeURIComponent(grado)}&categoria=${encodeURIComponent(categoria || '')}`;
          console.log('🔍 DEBUG Frontend - Chiamata API RAPPRESENTANTI:', url);
        }
        
        console.log('🔍 DEBUG Frontend - Categoria:', categoria);
        console.log('🔍 DEBUG Frontend - IsTestRoute:', isTestRoute);
        
        const response = await apiRequest("GET", url);

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati dal server.");
        }
        
        const result = await response.json();
        
        console.log('🔍 DEBUG Frontend - Risposta API:', result);
        
        if (!result.success) {
          throw new Error(result.error || "Errore nel caricamento dei dati");
        }
        
        if (isTestRoute) {
          // Per le route test, i dati sono direttamente nell'array data
          const candidati = result.data || [];
          console.log('🔍 DEBUG Frontend - Candidati ricevuti (TEST):', candidati.length);
          
          // Per le route test, recuperiamo le selezioni esistenti dall'API
          try {
            const selezioniResponse = await apiRequest("GET", `/api/elezioni/candidati`);
            if (selezioniResponse.ok) {
              const selezioniData = await selezioniResponse.json();
              if (selezioniData.success) {
                const { candidati: candidatiSelezionati } = selezioniData.data;
                const candidatoSelezionato = candidatiSelezionati[categoria]?.[0];
                setRappresentanteSelezionato(candidatoSelezionato?.id || null);
                console.log('🔍 DEBUG Frontend - Candidato selezionato per test (da API):', candidatoSelezionato);
              }
            }
          } catch (error) {
            console.log('⚠️ Errore nel recuperare selezioni test:', error);
            setRappresentanteSelezionato(null);
          }
          
          setRappresentanti(candidati);
        } else {
          // Per le route normali, i dati sono in { candidati, utente }
          const { candidati, utente } = result.data;
          console.log('🔍 DEBUG Frontend - Candidati ricevuti (NORMAL):', candidati?.length || 0);
          console.log('🔍 DEBUG Frontend - Utente:', utente);
          setRappresentanteSelezionato(utente?.[getFieldName(categoria, isTestRoute)] || null);
          setRappresentanti(candidati || []);
        }

      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i rappresentanti.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, categoria, toast]);

  return {
    rappresentanti,
    loading,
    rappresentanteSelezionato,
    setRappresentanteSelezionato
  };
};
