import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export const usePendingUserActions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation per approvare un utente
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", "/api/users/approve", {
        userId
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'approvazione');
      }
      
      return response.json();
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
      const response = await apiRequest("POST", "/api/users/reject", {
        userId,
        reason
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel rifiuto');
      }
      
      return response.json();
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
