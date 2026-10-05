import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { ClaimPhase, PoliticianProfile } from "./types";
import { useClaimForm } from "./hooks/useClaimForm";
import { useProfileSearch } from "./hooks/useProfileSearch";
import { Header } from "./components/Header";
import { SearchPhase } from "./components/SearchPhase";
import { ClaimForm } from "./components/ClaimForm";
import { SuccessPhase } from "./components/SuccessPhase";
import { PremiumSection } from "./components/PremiumSection";

export default function ReclamaProfilo() {
  const { user, isLoading } = useAuth();
  
  // State management
  const [currentPhase, setCurrentPhase] = useState<ClaimPhase>("search");
  const [selectedProfile, setSelectedProfile] = useState<PoliticianProfile | null>(null);
  
  // Hooks
  const claimForm = useClaimForm();
  const profileSearch = useProfileSearch();

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-b from-background to-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle profile claim
  const handleClaimProfile = (profile: PoliticianProfile) => {
    setSelectedProfile(profile);
    claimForm.prefillForm(profile);
    setCurrentPhase("form");
  };

  // Handle create new profile
  const handleCreateNewProfile = () => {
    setSelectedProfile(null);
    setCurrentPhase("form");
  };

  // Handle form submission success
  const handleSubmitSuccess = () => {
    setCurrentPhase("success");
  };

  // Handle new request
  const handleNewRequest = () => {
    setCurrentPhase("search");
    setSelectedProfile(null);
    // Reset form data
    claimForm.handleInputChange("nome", "");
    claimForm.handleInputChange("cognome", "");
    claimForm.handleInputChange("carica_attuale", "");
    claimForm.handleInputChange("ente_elettorale", "");
    claimForm.handleInputChange("email", "");
    claimForm.handleInputChange("riferimento_istituzionale", "");
    claimForm.handleInputChange("gdpr_accepted", false);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-secondary/20 page-with-navbar">
      <div className="container mx-auto p-4 max-w-6xl">
        
        {/* Header */}
        <Header />

        {/* Phase 1: Search Profile */}
        {currentPhase === "search" && (
          <SearchPhase
            searchQuery={profileSearch.searchQuery}
            setSearchQuery={profileSearch.setSearchQuery}
            searchResults={profileSearch.searchResults}
            isSearching={profileSearch.isSearching}
            onSearch={profileSearch.handleSearch}
            onClaimProfile={handleClaimProfile}
            onCreateNewProfile={handleCreateNewProfile}
          />
        )}

        {/* Phase 2: Form */}
        {currentPhase === "form" && (
          <ClaimForm
            formData={claimForm.formData}
            documents={claimForm.documents}
            selectedProfile={selectedProfile}
            onInputChange={claimForm.handleInputChange}
            onFileUpload={claimForm.handleFileUpload}
            onSubmit={() => {
              claimForm.handleSubmitClaim();
              // Listen for success
              if (claimForm.submitClaimMutation.isSuccess) {
                handleSubmitSuccess();
              }
            }}
            onBack={() => setCurrentPhase("search")}
            isSubmitting={claimForm.submitClaimMutation.isPending}
          />
        )}

        {/* Phase 3: Success */}
        {currentPhase === "success" && (
          <SuccessPhase onNewRequest={handleNewRequest} />
        )}

        {/* Premium Benefits Section */}
        <PremiumSection />
      </div>
    </div>
  );
}
