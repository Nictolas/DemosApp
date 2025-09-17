import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Candidato, OpinioniDialogData } from "../types";
import { getFieldName } from "../utils/candidatoUtils";

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
        console.log('🔍 DEBUG Frontend - Fetching candidati per categoria:', categoria);
        
        const result = await apiRequest(
          "GET",
          `/api/test/disponibili?grado_candidatura=${categoria}`
        );

        if (!result.ok) {
          throw new Error("Impossibile caricare i candidati.");
        }

        const data = await result.json();
        console.log('🔍 DEBUG Frontend - Risultato API candidati:', data);

        if (data.success) {
          const candidati = data.data || [];
          console.log('🔍 DEBUG Frontend - Candidati ricevuti (TEST):', candidati.length);
          setCandidatoSelezionato(null); // Nessun candidato selezionato per le route test
          setCandidati(candidati);
        }

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
