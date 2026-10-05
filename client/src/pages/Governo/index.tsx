import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useGovernoData } from "./hooks/useGovernoData";
import { useGovernoActions } from "./hooks/useGovernoActions";
import { useConsensoGovernoData } from "./hooks/useConsensoGovernoData";
import { MinisteroCard } from "./components/MinisteroCard";
import { MinisteroModal } from "./components/MinisteroModal";
import { ConsensoGovernoSection } from "./components/ConsensoGovernoSection";
import { GovernoAttualeSection } from "./components/GovernoAttualeSection";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { ministeri, colorMap } from "./constants/ministeri";
import { Ministero } from "./types";

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data, isLoading, isError } = useGovernoData(user);
  const { handleNavigateToMinistero } = useGovernoActions();
  
  // Hook per i dati di consenso del governo
  const { 
    data: consensoData, 
    isLoading: isLoadingConsenso, 
    voteConsenso, 
    isVoting: isVotingConsenso 
  } = useConsensoGovernoData(user);
  
  // Stato per il modal
  const [selectedMinistero, setSelectedMinistero] = useState<Ministero | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (ministero: Ministero) => {
    setSelectedMinistero(ministero);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMinistero(null);
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-linear-to-b from-background to-secondary/20 pt-4 page-with-navbar">
        <div className="container mx-auto max-w-6xl p-4">
          {/* Sezione Consenso Governo */}
          {consensoData && (
            <ConsensoGovernoSection
              data={consensoData}
              onVote={voteConsenso}
              isVoting={isVotingConsenso}
            />
          )}

          {/* Sezione Governo Attuale */}
          <GovernoAttualeSection />
          
          {/* Modal */}
          {selectedMinistero && (
            <MinisteroModal
              ministero={selectedMinistero}
              data={data}
              isOpen={isModalOpen}
              onClose={handleCloseModal}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
