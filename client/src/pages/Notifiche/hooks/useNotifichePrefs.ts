import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export const useNotifichePrefs = () => {
  const { toast } = useToast();

  // Mutazione per preferenze notifiche
  const prefsMutation = useMutation({
    mutationFn: (newPrefs: Record<string, boolean>) => 
      apiRequest("POST", "/api/notifiche/preferenze", { preferenze: newPrefs }),
    onSuccess: () => toast({ title: "Preferenze salvate" }),
    onError: () => toast({ 
      title: "Errore", 
      description: "Impossibile salvare le preferenze.", 
      variant: "destructive" 
    }),
  });

  const handleSwitch = (key: string, value: boolean) => {
    // Preferenze per rappresentanti (le notifiche in-app e push sono sempre attive)
    const rappresentantiPrefs = {
      eurodeputato: true,
      senatore: true,
      deputato: true,
      consigliere_regionale: true,
      consigliere_comunale: true,
      demos: true
    };
    
    const currentPrefs = { ...rappresentantiPrefs };
    const newPrefs = { ...currentPrefs, [key]: value };
    
    console.log('🔍 DEBUG Preferenze - Salvataggio:', { key, value, newPrefs });
    prefsMutation.mutate(newPrefs);
  };

  return {
    prefsMutation,
    handleSwitch
  };
};
