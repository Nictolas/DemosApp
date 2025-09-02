import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Rappresentante, OpinioniDialogData } from "../types";
import { getTitolo, getFieldName } from "../utils/rappresentanteUtils";

export const useRappresentantiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const [rappresentanti, setRappresentanti] = useState<Rappresentante[]>([]);
  const [loading, setLoading] = useState(true);
  const [rappresentanteSelezionato, setRappresentanteSelezionato] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const response = await apiRequest(
          "GET", 
          `/api/rappresentanti/disponibili?grado=${encodeURIComponent(getTitolo(categoria))}&categoria=${encodeURIComponent(categoria || '')}`
        );

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati dal server.");
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || "Errore nel caricamento dei dati");
        }
        
        const { candidati, utente } = result.data;
        
        setRappresentanteSelezionato(utente[getFieldName(categoria)] || null);
        setRappresentanti(candidati);

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
