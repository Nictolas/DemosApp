import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Candidato, OpinioniDialogData } from "../types";
import { getFieldName, getTitolo } from "../utils/candidatoUtils";

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

export const useCandidatiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const [candidati, setCandidati] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidatoSelezionato, setCandidatoSelezionato] = useState<string | null>(null);
  const [showOpinioniAlert, setShowOpinioniAlert] = useState(false);
  const [opinioniAlertData, setOpinioniAlertData] = useState<any>(null);

  // Mappa categoria a grado per il controllo opinioni
  const gradoMapping: Record<string, string> = {
    'camera': 'N',
    'senato': 'N', 
    'europee': 'E',
    'regionali': 'R',
    'comunali': 'C'
  };

  const grado = gradoMapping[categoria] || 'N';
  const { checkOpinioni } = useOpinioniCheck(grado);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        console.log('🔍 DEBUG Frontend - Controllo opinioni per grado:', grado);
        
        // Prima controlla le opinioni mancanti
        const opinioniCheck = await checkOpinioni();
        
        if (opinioniCheck && !opinioniCheck.isComplete) {
          console.log('⚠️ Opinion incomplete trovate:', opinioniCheck);
          setOpinioniAlertData(opinioniCheck);
          setShowOpinioniAlert(true);
        }
        
        console.log('🔍 DEBUG Frontend - Fetching candidati per categoria:', categoria);
        
        // Mappa la categoria al grado_candidatura corretto
        const gradoCandidatura = getTitolo(categoria);
        const url = `/api/candidati/disponibili?grado_candidatura=${encodeURIComponent(gradoCandidatura)}`;
        console.log('🔍 DEBUG Frontend - Chiamata API CANDIDATI:', url);
        console.log('🔍 DEBUG Frontend - Categoria mappata:', categoria, '->', gradoCandidatura);
        
        const response = await apiRequest("GET", url);

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati dal server.");
        }

        const result = await response.json();
        console.log('🔍 DEBUG Frontend - Risposta API candidati:', result);
        
        // Debug dettagliato per ogni candidato ricevuto
        if (result.success && result.data) {
          console.log('🔍 DEBUG Frontend - Dettagli candidati ricevuti:');
          result.data.forEach((candidato, index) => {
            console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome}:`, {
              opinioniComuni: candidato.opinioniComuni,
              ruolo: candidato.ruolo,
              status: candidato.status
            });
          });
        }

        if (!result.success) {
          throw new Error(result.error || "Errore nel caricamento dei dati");
        }

        // I dati sono direttamente nell'array data
        const candidati = result.data || [];
        console.log('🔍 DEBUG Frontend - Candidati ricevuti:', candidati.length);
        
        // Recuperiamo le selezioni esistenti dall'API
        try {
          const selezioniResponse = await apiRequest("GET", `/api/candidati/selezioni`);
          if (selezioniResponse.ok) {
            const selezioniData = await selezioniResponse.json();
            if (selezioniData.success) {
              const { candidati: candidatiSelezionati } = selezioniData.data;
              const candidatoSelezionato = candidatiSelezionati[categoria]?.[0];
              setCandidatoSelezionato(candidatoSelezionato?.id || null);
              console.log('🔍 DEBUG Frontend - Candidato selezionato:', candidatoSelezionato);
            }
          }
        } catch (error) {
          console.log('⚠️ Errore nel recuperare selezioni:', error);
          setCandidatoSelezionato(null);
        }
        
        setCandidati(candidati);

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
    setCandidatoSelezionato,
    showOpinioniAlert,
    setShowOpinioniAlert,
    opinioniAlertData
  };
};
