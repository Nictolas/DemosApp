import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LogoutState } from "../types";

export const useLogout = () => {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<LogoutState>({
    isLoggingOut: false,
    showLogoutDialog: false
  });

  const showLogoutDialog = () => setState(prev => ({ ...prev, showLogoutDialog: true }));
  const hideLogoutDialog = () => setState(prev => ({ ...prev, showLogoutDialog: false }));

  const handleLogout = async () => {
    setState(prev => ({ ...prev, isLoggingOut: true }));
    
    try {
      await logoutMutation.mutateAsync();
      // Il redirect viene gestito dal hook useAuth
    } catch {
      // Keep diagnostics free of exception bodies (may contain account/session data).
      console.error('Errore logout (dettagli omessi)');
      toast({
        title: "Errore",
        description: "Errore durante il logout. Riprova.",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, isLoggingOut: false }));
    }
  };

  return {
    state,
    showLogoutDialog,
    hideLogoutDialog,
    handleLogout
  };
};
