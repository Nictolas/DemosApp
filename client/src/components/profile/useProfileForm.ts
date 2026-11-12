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
  onProfileUpdated: (updatedData: UserInfo) => void
) {
  const { toast } = useToast();
  const initialData = {
    ...userData,
    data_nascita: normalizeDate(userData?.data_nascita),
  };
  const [formData, setFormData] = useState<UserInfo & { uid: string }>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Aggiorna formData quando userData cambia
  useEffect(() => {
    const newInitialData = {
      ...userData,
      data_nascita: normalizeDate(userData?.data_nascita),
    };
    setFormData(newInitialData);
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
      // Prepara i dati da inviare: invia solo i campi che sono stati modificati
      // rispetto ai dati originali, oppure tutti i campi se non abbiamo i dati originali
      const dataToSend: Record<string, any> = {};
      const currentInitialData = {
        ...userData,
        data_nascita: normalizeDate(userData?.data_nascita),
      };
      
      const editableSelfFields = new Set([
        "data_nascita", "genere", "cittadinanza",
        "paese_residenza", "regione_residenza", "provincia_residenza", "comune_residenza"
      ]);
      Object.keys(formData).forEach(key => {
        if (key === 'uid' || key === 'ruolo' || key === 'sesso' || key === 'account_type') return;
        if (!editableSelfFields.has(key)) return;
        
        // Normalizza i valori per il confronto: null, undefined e stringa vuota sono considerati equivalenti
        const normalizeValue = (val: any) => {
          if (val === null || val === undefined || val === '') return '';
          return val;
        };
        
        const currentValue = formData[key as keyof typeof formData];
        const originalValue = currentInitialData[key as keyof typeof currentInitialData];
        
        const normalizedCurrent = normalizeValue(currentValue);
        const normalizedOriginal = normalizeValue(originalValue);
        
        // Invia il campo se il valore normalizzato è diverso
        if (normalizedCurrent !== normalizedOriginal) {
          // Invia il valore corrente (anche se è stringa vuota, per permettere la cancellazione)
          if (currentValue !== undefined) {
            dataToSend[key] = currentValue === '' ? null : currentValue;
          }
        }
      });
      
      // Se non ci sono modifiche, non inviare nulla
      if (Object.keys(dataToSend).length === 0) {
        toast({
          title: "Nessuna modifica",
          description: "Non ci sono modifiche da salvare",
        });
        setIsSubmitting(false);
        return;
      }

      // Prima aggiorna il profilo normale
      // apiRequest restituisce già i dati JSON parsati, non un oggetto Response
      const response = await apiRequest("PUT", "/api/users/me", dataToSend);
      const data = response.data ?? await response.json();
      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Errore durante l'aggiornamento del profilo");
      }

      // Aggiorna i dati locali con la risposta del server
      const updatedUser = data.user || formData;
      onProfileUpdated(updatedUser);
      

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
