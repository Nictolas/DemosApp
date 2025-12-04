import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MinisteroData } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useMinisteroData = (user: any, categoria?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per caricare i dati del ministero specifico
  const { data, isLoading, isError } = useQuery<MinisteroData>({
    queryKey: ['ministeroVoti', categoria],
    queryFn: async () => {
      console.log('🔍 DEBUG Frontend - Chiamata API per categoria:', categoria);
      const response = await apiRequest("GET", `/api/governo/ministro/${categoria}/voti`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Errore nel caricamento dei dati del ministero: ${response.status} - ${errorText}`);
      }
      const result = await response.json();
      console.log('🔍 DEBUG Frontend - Risposta API ricevuta:', result);
      console.log('🔍 DEBUG Frontend - result.classifiche:', result.classifiche);
      console.log('🔍 DEBUG Frontend - typeof result.classifiche:', typeof result.classifiche);
      console.log('🔍 DEBUG Frontend - Array.isArray(result.classifiche):', Array.isArray(result.classifiche));
      
      // Converti voti da stringa a numero
      const processedResult = {
        ...result,
        classifiche: result.classifiche ? result.classifiche.map((c: any) => ({
          ...c,
          voti: parseInt(c.voti, 10)
        })) : []
      };
      
      console.log('🔍 DEBUG Frontend - Risposta API processata:', processedResult);
      return processedResult;
    },
    enabled: !!user && !!categoria
  });

  // Mutazione per salvare i voti del ministero
  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      const response = await apiRequest("POST", `/api/governo/ministro/${categoria}/vota`, { voti });
      if (!response?.ok) {
        throw new Error(response?.data?.error || 'Errore nel salvataggio');
      }
      return response;
    },
    onSuccess: async (data, variables) => {
      console.log('✅ DEBUG - Voti salvati con successo:', variables);
      toast({ title: "Preferenze salvate", description: "Le tue scelte per questo ministero sono state aggiornate." });
      // Invalida e forza il refetch immediato per aggiornare i dati
      await queryClient.invalidateQueries({ queryKey: ['ministeroVoti', categoria] });
      // Forza il refetch immediato per vedere i dati aggiornati
      const result = await queryClient.refetchQueries({ queryKey: ['ministeroVoti', categoria] });
      console.log('✅ DEBUG - Dati ricaricati dopo salvataggio:', result);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le preferenze.", variant: "destructive" });
    }
  });

  return {
    data,
    isLoading,
    isError,
    saveVotiMutation
  };
};
