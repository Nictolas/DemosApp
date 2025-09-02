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
    const currentPrefs = { tutte: true, email: true, push: true };
    const newPrefs = { ...currentPrefs, [key]: value };
    prefsMutation.mutate(newPrefs);
  };

  return {
    prefsMutation,
    handleSwitch
  };
};
