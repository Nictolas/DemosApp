import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ElezioniData, UserData, Elezione, Candidato } from "../types";

export const useElezioniData = (user: any) => {
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [elezioni, setElezioni] = useState<Elezione[]>([]);
  const [candidatiDettagliati, setCandidatiDettagliati] = useState<Record<string, Candidato>>({});

  useEffect(() => {
    const fetchPageData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // 1. Usiamo un singolo endpoint API che restituisce tutti i dati necessari per questa pagina
        const response = await apiRequest("GET", `/api/elezioni-utente`);

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati delle elezioni.");
        }

        const { utente, elezioni, candidati } = await response.json();
        
        // 2. Impostiamo i dati ricevuti dal backend
        setUserData(utente);
        setElezioni(elezioni);
        setCandidatiDettagliati(candidati);

      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i dati delle elezioni.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPageData();
  }, [user, toast]);

  return {
    userData,
    elezioni,
    candidatiDettagliati,
    loading
  };
};
