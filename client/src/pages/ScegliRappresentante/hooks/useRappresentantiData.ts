import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Rappresentante, OpinioniDialogData } from "../types";
import { getTitolo, getFieldName } from "../utils/rappresentanteUtils";
import { getTitolo as getTitoloCandidati } from "../utils/candidatoUtils";
import { useRoute } from "wouter";

// Hook per controllare opinioni mancanti
const useOpinioniCheck = (grado: string) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);

  const checkOpinioni = async () => {
    if (!grado) return null;
    
    setIsChecking(true);
    try {
      const response = await apiRequest("GET", `/api/opinioni/check-missing/${grado}`);
      if (response.ok) {
        const result = await response.json();
        setCheckResult(result.data);
        return result.data;
      }
    } catch (error) {
      console.error("Errore nel controllo opinioni:", error);
    } finally {
      setIsChecking(false);
    }
    return null;
  };

  return { checkOpinioni, isChecking, checkResult };
};

export const useRappresentantiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const [rappresentanti, setRappresentanti] = useState<Rappresentante[]>([]);
  const [loading, setLoading] = useState(true);
  const [rappresentanteSelezionato, setRappresentanteSelezionato] = useState<string | null>(null);
  const [showOpinioniAlert, setShowOpinioniAlert] = useState(false);
  const [opinioniAlertData, setOpinioniAlertData] = useState<any>(null);
  
  // Detect if the current route is under /candidati
  const [isTestRoute] = useRoute("/candidati/:categoria");

  // Mappa categoria a grado per il controllo opinioni
  const gradoMapping: Record<string, string> = {
    'camera': 'N',
    'senato': 'N', 
    'europeo': 'E',
    'regione': 'R',
    'comune': 'CO'  // Corretto: comune usa grado CO, non C
  };

  const grado = gradoMapping[categoria] || 'N';
  const { checkOpinioni } = useOpinioniCheck(grado);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        
        let url = '';
        if (isTestRoute) {
          // Use the new API endpoint for test routes (candidati)
          // Mappa la categoria al grado_candidatura corretto
          const gradoCandidatura = getTitoloCandidati(categoria);
          url = `/api/candidati/disponibili?grado_candidatura=${encodeURIComponent(gradoCandidatura)}`;
          console.log('🔍 DEBUG Frontend - Chiamata API CANDIDATI:', url);
          console.log('🔍 DEBUG Frontend - Categoria mappata:', categoria, '->', gradoCandidatura);
        } else {
          // Use the existing API endpoint for regular rappresentanti routes
          const grado = getTitolo(categoria);
          url = `/api/rappresentanti/disponibili?grado_elezione=${encodeURIComponent(grado)}`;
          console.log('🔍 DEBUG Frontend - Chiamata API RAPPRESENTANTI:', url);
        }
        
        console.log('🔍 DEBUG Frontend - Categoria:', categoria);
        console.log('🔍 DEBUG Frontend - IsTestRoute:', isTestRoute);
        console.log('🔍 DEBUG Frontend - URL finale:', url);
        
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
