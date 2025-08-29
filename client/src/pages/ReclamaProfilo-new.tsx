import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  ProfileSearch, 
  ClaimForm, 
  SuccessMessage, 
  PremiumBenefits, 
  AccountTypesPreview,
  premiumBenefits,
  accountTypes,
  type Profile,
  type ClaimFormData,
  type Documents,
  type ClaimPhase
} from "@/components/reclama-profilo";

export default function ReclamaProfilo() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [currentPhase, setCurrentPhase] = useState<ClaimPhase>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<ClaimFormData>({
    nome: "",
    cognome: "",
    carica_attuale: "",
    ente_elettorale: "",
    email: "",
    telefono: "",
    gdpr_accepted: false
  });
  
  // Documents
  const [documents, setDocuments] = useState<Documents>({
    documento_identita: null,
    certificazione_elezione: null,
    dichiarazione_carica: null
  });

  // Redirect if not authenticated
  if (!user) {
    return <Redirect to="/login" />;
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/search-profiles?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Errore di ricerca",
        description: "Si è verificato un errore durante la ricerca",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle profile claim
  const handleClaimProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setFormData(prev => ({
      ...prev,
      nome: profile.nome,
      cognome: profile.cognome
    }));
    setCurrentPhase("form");
  };

  // Handle create new profile
  const handleCreateNewProfile = () => {
    setSelectedProfile(null);
    setFormData({
      nome: "",
      cognome: "",
      carica_attuale: "",
      ente_elettorale: "",
      email: "",
      telefono: "",
      gdpr_accepted: false
    });
    setCurrentPhase("form");
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle file uploads
  const handleFileUpload = (field: keyof Documents, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [field]: file
    }));
  };

  // Submit claim request
  const submitClaimMutation = useMutation({
    mutationFn: async (claimData: any) => {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.keys(formData).forEach(key => {
        if (key !== 'gdpr_accepted') {
          formDataToSend.append(key, formData[key as keyof typeof formData] as string);
        }
      });
      
      // Add selected profile info
      if (selectedProfile) {
        formDataToSend.append('profile_id', selectedProfile.id);
      }
      
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
      setCurrentPhase("success");
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

  const handleSubmitClaim = () => {
    // Validation
    if (!formData.nome || !formData.cognome || !formData.carica_attuale || 
        !formData.ente_elettorale || !formData.email || !formData.gdpr_accepted) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Compila tutti i campi obbligatori e accetta i termini",
        variant: "destructive"
      });
      return;
    }

    if (!documents.documento_identita || !documents.certificazione_elezione || 
        !documents.dichiarazione_carica) {
      toast({
        title: "Documenti mancanti",
        description: "Carica tutti i documenti richiesti",
        variant: "destructive"
      });
      return;
    }

    submitClaimMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 page-with-navbar">
      <div className="container mx-auto p-4 max-w-6xl">
        
        {/* Header */}
        <Card className="mt-6 mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Reclama Profilo
            </CardTitle>
            <CardDescription className="text-lg">
              Sei un rappresentante eletto? Verifica subito se il tuo profilo esiste e richiedi il 'badge verificato' per accedere a DEMOS Premium!
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Phase Components */}
        {currentPhase === "search" && (
          <ProfileSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
            searchResults={searchResults}
            onClaimProfile={handleClaimProfile}
            onCreateNewProfile={handleCreateNewProfile}
          />
        )}

        {currentPhase === "form" && (
          <ClaimForm
            selectedProfile={selectedProfile}
            formData={formData}
            documents={documents}
            onInputChange={handleInputChange}
            onFileUpload={handleFileUpload}
            onSubmit={handleSubmitClaim}
            onBack={() => setCurrentPhase("search")}
            isSubmitting={submitClaimMutation.isPending}
          />
        )}

        {currentPhase === "success" && (
          <SuccessMessage onNewRequest={() => setCurrentPhase("search")} />
        )}

        {/* Premium Benefits Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <PremiumBenefits benefits={premiumBenefits} />
          <AccountTypesPreview accountTypes={accountTypes} />
        </div>
      </div>
    </div>
  );
}
