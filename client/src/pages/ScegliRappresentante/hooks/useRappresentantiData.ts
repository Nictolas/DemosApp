import { useState, useEffect, useCallback, useRef } from "react";
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

  const checkOpinioni = useCallback(async () => {
    if (!grado) return null;
    
    setIsChecking(true);
    try {
      const response = await apiRequest("GET", `/api/opinioni/check-missing/${grado}`);
      if (response?.ok && response?.data) {
        const result = response.data;
        if (result && result.success) {
          setCheckResult(result.data);
          return result.data;
        }
      }
    } catch (error) {
      console.error("Errore nel controllo opinioni:", error);
    } finally {
      setIsChecking(false);
    }
    return null;
  }, [grado]);

  return { checkOpinioni, isChecking, checkResult };
};

export const useRappresentantiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  
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

  // Controlla le opinioni incomplete in un useEffect separato
  useEffect(() => {
    if (!user || !grado) return;
    
    checkOpinioni().then((opinioniCheck) => {
      if (opinioniCheck && !opinioniCheck.isComplete) {
        console.log('🔍 DEBUG - Opinion incomplete trovate, mostrando alert');
        setOpinioniAlertData(opinioniCheck);
        setShowOpinioniAlert(true);
      }
    }).catch((error) => {
      console.error("Errore nel controllo opinioni:", error);
    });
  }, [user, grado, checkOpinioni]);

  useEffect(() => {
    console.log('🔍 DEBUG Frontend - useEffect eseguito', { user: !!user, categoria, isTestRoute });
    
    const fetchData = async () => {
      if (!user) {
        console.log('🔍 DEBUG Frontend - User non disponibile, impostando loading a false');
        setLoading(false);
        return;
      }
      
      console.log('🔍 DEBUG Frontend - Inizio fetchData, impostando loading a true');
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
        
        console.log('🔍 DEBUG Frontend - Risposta API:', response);
        console.log('🔍 DEBUG Frontend - response.ok:', response?.ok);
        console.log('🔍 DEBUG Frontend - response.data:', response?.data);
        console.log('🔍 DEBUG Frontend - response.data type:', typeof response?.data);
        console.log('🔍 DEBUG Frontend - response.data keys:', response?.data ? Object.keys(response.data) : 'N/A');
        
        if (!response?.ok || !response?.data) {
          const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei dati dal server.";
          console.log('🔍 DEBUG Frontend - Risposta non ok o dati mancanti, errore:', errorMsg);
          throw new Error(errorMsg);
        }
        
        const result = response.data;
        console.log('🔍 DEBUG Frontend - result:', result);
        console.log('🔍 DEBUG Frontend - result.success:', result?.success);
        console.log('🔍 DEBUG Frontend - result.data:', result?.data);
        console.log('🔍 DEBUG Frontend - result.error:', result?.error);
        
        if (!result || !result.success) {
          const errorMsg = result?.error || result?.message || "Errore nel caricamento dei dati dal server.";
          console.log('🔍 DEBUG Frontend - result.success è false o undefined, errore:', errorMsg);
          throw new Error(errorMsg);
        }
        
        if (isTestRoute) {
          // Per le route test, i dati sono direttamente nell'array data
          const candidati = result.data || [];
          console.log('🔍 DEBUG Frontend - Candidati ricevuti (TEST):', candidati.length);
          
          // Per le route test, recuperiamo le selezioni esistenti dall'API
          try {
            const selezioniResponse = await apiRequest("GET", `/api/elezioni/candidati`);
            if (selezioniResponse?.ok && selezioniResponse?.data) {
              const selezioniResult = selezioniResponse.data;
              if (selezioniResult && selezioniResult.success) {
                const { candidati: candidatiSelezionati } = selezioniResult.data;
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
          if (!result.data) {
            throw new Error("Struttura dati non valida dalla risposta API");
          }
          
          const { candidati, utente } = result.data;
          console.log('🔍 DEBUG Frontend - Candidati ricevuti (NORMAL):', candidati?.length || 0);
          console.log('🔍 DEBUG Frontend - Candidati array completo:', candidati);
          console.log('🔍 DEBUG Frontend - Utente:', utente);
          const fieldName = getFieldName(categoria, isTestRoute);
          console.log('🔍 DEBUG Frontend - Field name:', fieldName);
          console.log('🔍 DEBUG Frontend - Rappresentante selezionato:', utente?.[fieldName]);
          setRappresentanteSelezionato(utente?.[fieldName] || null);
          setRappresentanti(candidati || []);
          console.log('🔍 DEBUG Frontend - Stato aggiornato, rappresentanti impostati:', candidati?.length || 0);
        }

      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toastRef.current({
          title: "Errore",
          description: "Impossibile caricare i rappresentanti.",
          variant: "destructive",
        });
      } finally {
        console.log('🔍 DEBUG Frontend - Impostando loading a false');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, categoria, isTestRoute]);

  return {
    rappresentanti,
    loading,
    rappresentanteSelezionato,
    setRappresentanteSelezionato,
    showOpinioniAlert,
    setShowOpinioniAlert,
    opinioniAlertData
  };
};
