import { useState, useEffect } from "react";
import { UserInfo } from "@/types/profile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Funzione di utilità per normalizzare la data nel formato YYYY-MM-DD
function normalizeDate(dateStr?: string): string {
  if (!dateStr) return "";
  // Se già in formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Se in formato DD/MM/YYYY o D/M/YYYY
  const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Altri formati: prova a restituire la stringa originale
  return dateStr;
}

export function useProfileForm(
  userData: UserInfo & { uid: string },
  onProfileUpdated: (updatedData: UserInfo) => void,
  isAdmin: boolean = false
) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<UserInfo & { uid: string }>({
    ...userData,
    data_nascita: normalizeDate(userData?.data_nascita),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Aggiorna formData quando userData cambia
  useEffect(() => {
    setFormData({
      ...userData,
      data_nascita: normalizeDate(userData?.data_nascita),
    });
  }, [userData]);

  // Funzione generica per aggiornare il formData
  const handleChange = (field: keyof (UserInfo & { uid: string }), value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prima aggiorna il profilo normale
      const endpoint = isAdmin ? `/api/users/${userData.uid}` : "/api/users/me";
      const response = await apiRequest("PUT", endpoint, formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante l'aggiornamento del profilo");
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Errore durante l'aggiornamento del profilo");
      }

      // Se l'utente ha tipologie di attivismo, aggiornale separatamente
      if (formData.tipologie_attivismo && formData.tipologie_attivismo.length > 0) {
        const activismEndpoint = `/api/attivismo-tipologie/${userData.uid}`;
        const activismResponse = await apiRequest("PUT", activismEndpoint, {
          tipologie: formData.tipologie_attivismo
        });
        
        if (!activismResponse.ok) {
          console.warn("Errore nell'aggiornamento delle tipologie di attivismo:", await activismResponse.text());
          // Non bloccare il salvataggio del profilo per questo errore
        }
      }
      
      onProfileUpdated(data.user || formData);
      
      toast({
        title: "Successo",
        description: "Profilo aggiornato con successo!",
      });
      
    } catch (error) {
      console.error("Errore durante l'aggiornamento:", error);
      
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Si è verificato un errore durante l'aggiornamento del profilo",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    isSubmitting,
    handleChange,
    handleSubmit,
  };
}
