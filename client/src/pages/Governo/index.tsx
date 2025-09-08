import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useGovernoData } from "./hooks/useGovernoData";
import { useGovernoActions } from "./hooks/useGovernoActions";
import { MinisteroCard } from "./components/MinisteroCard";
import { MinisteroModal } from "./components/MinisteroModal";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { ministeri, colorMap } from "./constants/ministeri";
import { Ministero } from "./types";

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data, isLoading, isError } = useGovernoData(user);
  const { handleNavigateToMinistero } = useGovernoActions();
  
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
      <div className="h-screen bg-gradient-to-b from-background to-secondary/20 overflow-hidden page-with-navbar">
        <div className="h-full flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingState />
            </div>
          ) : isError ? (
            <div className="flex-1 flex items-center justify-center">
              <ErrorState />
            </div>
          ) : (
            <div className="flex-1 p-2 overflow-hidden">
              <div className="h-full grid grid-cols-3 gap-1 auto-rows-[minmax(0,1fr)]">
                {ministeri.map((ministero) => (
                  <MinisteroCard
                    key={ministero.id}
                    ministero={ministero}
                    data={data}
                    onNavigate={handleNavigateToMinistero}
                    onOpenModal={handleOpenModal}
                    isWide={ministero.id === "primo_ministro"}
                  />
                ))}
              </div>
            </div>
          )}
          
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
