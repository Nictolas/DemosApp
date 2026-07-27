import { useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth-token";
import { ChangePasswordForm, PasswordChangeState } from "../types";

type UsePasswordChangeOptions = {
  onSuccess?: () => void;
};

export const usePasswordChange = (options?: UsePasswordChangeOptions) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ChangePasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [state, setState] = useState<PasswordChangeState>({
    isChangingPassword: false,
    showChangePassword: false
  });

  const updateFormField = (field: keyof ChangePasswordForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const showForm = () => setState(prev => ({ ...prev, showChangePassword: true }));
  
  const hideForm = () => {
    setState(prev => ({ ...prev, showChangePassword: false }));
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  const resetForm = () => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono.",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri.",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, isChangingPassword: true }));
    
    try {
      const token = getAuthToken() || localStorage.getItem('authToken');
      const response = await fetch(getApiUrl('/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Successo",
          description: "Password aggiornata con successo!",
          variant: "default",
        });
        resetForm();
        hideForm();
        options?.onSuccess?.();
      } else {
        toast({
          title: "Errore",
          description: data.error || data.message || "Errore durante il cambio password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore di connessione. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setState(prev => ({ ...prev, isChangingPassword: false }));
    }
  };

  return {
    formData,
    state,
    updateFormField,
    showForm,
    hideForm,
    handleChangePassword
  };
};
