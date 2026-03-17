import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export const usePendingUserActions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation per approvare un utente
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      // apiRequest restituisce già il JSON parsato, non un Response
      const data = await apiRequest("POST", "/api/users/approve", {
        userId
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Errore nell\'approvazione');
      }
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Utente approvato!",
        description: `L'utente ${data.user.email} è stato approvato con successo`,
        variant: "default"
      });
      
      // Invalida e ricarica i dati degli utenti
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error) => {
      toast({
        title: "Errore nell'approvazione",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation per rifiutare un utente
  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      // apiRequest restituisce già il JSON parsato, non un Response
      const data = await apiRequest("POST", "/api/users/reject", {
        userId,
        reason
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Errore nel rifiuto');
      }
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Utente eliminato",
        description: `L'utente ${data.user.email} è stato rifiutato e eliminato completamente dal database`,
        variant: "default"
      });
      
      // Invalida e ricarica i dati degli utenti
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error) => {
      toast({
        title: "Errore nel rifiuto",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    approveUser: approveMutation.mutate,
    rejectUser: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isProcessing: approveMutation.isPending || rejectMutation.isPending
  };
};
