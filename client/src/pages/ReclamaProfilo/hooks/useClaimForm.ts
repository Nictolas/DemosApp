import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ClaimFormData, ClaimDocuments, PoliticianProfile } from "../types";

export const useClaimForm = () => {
  const { toast } = useToast();
  
  // Form state
  const [formData, setFormData] = useState<ClaimFormData>({
    nome: "",
    cognome: "",
    carica_attuale: "",
    ente_elettorale: "",
    email: "",
    riferimento_istituzionale: "",
    gdpr_accepted: false
  });
  
  const [documents, setDocuments] = useState<ClaimDocuments>({
    documento_identita: null,
    certificazione_elezione: null,
    dichiarazione_carica: null
  });

  // Handle form input changes
  const handleInputChange = (field: keyof ClaimFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle file uploads
  const handleFileUpload = (field: keyof ClaimDocuments, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [field]: file
    }));
  };

  // Pre-fill form with selected profile
  const prefillForm = (profile: PoliticianProfile) => {
    setFormData(prev => ({
      ...prev,
      nome: profile.nome || "",
      cognome: profile.cognome || ""
    }));
  };

  // Submit claim request
  const submitClaimMutation = useMutation({
    mutationFn: async (claimData: ClaimFormData) => {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.keys(claimData).forEach(key => {
        if (key !== 'gdpr_accepted') {
          formDataToSend.append(key, claimData[key as keyof ClaimFormData] as string);
        }
      });
      
      // Add documents
      Object.entries(documents).forEach(([key, file]) => {
        if (file) {
          formDataToSend.append(key, file);
        }
      });

      const response = await fetch('/api/claim-profile', {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Failed to submit claim request');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Richiesta inviata!",
        description: "Riceverai una notifica non appena verificato.",
      });
    },
    onError: (error) => {
      console.error("Claim submission error:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio della richiesta",
        variant: "destructive"
      });
    }
  });

  // Validation
  const validateForm = (): boolean => {
    if (!formData.nome || !formData.cognome || !formData.carica_attuale || 
        !formData.ente_elettorale || !formData.email || !formData.gdpr_accepted) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Compila tutti i campi obbligatori e accetta i termini",
        variant: "destructive"
      });
      return false;
    }

    if (!documents.documento_identita || !documents.certificazione_elezione || 
        !documents.dichiarazione_carica) {
      toast({
        title: "Documenti mancanti",
        description: "Carica tutti i documenti richiesti",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  // Submit form
  const handleSubmitClaim = () => {
    if (validateForm()) {
      submitClaimMutation.mutate(formData);
    }
  };

  return {
    formData,
    documents,
    handleInputChange,
    handleFileUpload,
    prefillForm,
    handleSubmitClaim,
    submitClaimMutation
  };
};
