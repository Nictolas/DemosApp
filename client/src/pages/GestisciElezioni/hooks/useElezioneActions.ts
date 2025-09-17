import { useToast } from "@/hooks/use-toast";
import apiRequest from "@/lib/api-request";

export const useElezioneActions = (onSuccess: () => void) => {
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa elezione?')) return;
    try {
      // 4. Elimina un'elezione tramite API
      const response = await apiRequest("DELETE", `/api/elezioni/${id}`);
      if (!response.ok) throw new Error("Eliminazione fallita.");
      
      toast({ title: "Successo", description: "Elezione eliminata con successo" });
      onSuccess();
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'elezione", variant: "destructive" });
    }
  };

  return {
    handleDelete,
  };
};
