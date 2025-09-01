import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ApprovalAction } from '../types';

export const useUsersActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approvalMutation = useMutation({
    mutationFn: ({ userId, approve }: ApprovalAction) => {
      const endpoint = approve ? '/api/utenti/approve' : '/api/utenti/reject';
      return apiRequest('POST', endpoint, { userId });
    },
    onSuccess: (_, { approve }) => {
      toast({ 
        title: `Utente ${approve ? 'approvato' : 'rifiutato'}`, 
        description: "La lista utenti è stata aggiornata." 
      });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Azione fallita.', 
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userUid: string) => apiRequest("DELETE", `/api/utenti/${userUid}`),
    onSuccess: () => {
      toast({ 
        title: 'Utente eliminato', 
        description: 'L\'utente è stato eliminato con successo.' 
      });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Eliminazione fallita.', 
        variant: 'destructive' 
      });
    },
  });

  return {
    approvalMutation,
    deleteMutation
  };
};
