import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { EditProfileForm } from "@/components/EditProfileForm";
import { ProfileRepresentatives } from "@/components/ProfileRepresentatives";
import { ProfileCandidates } from "@/components/ProfileCandidates";

// Componenti modulari
import { ProfileLoadingStates } from "./components/ProfileLoadingStates";
import { ProfileInfo } from "./components/ProfileInfo";
import { ProfileOpinions } from "./components/ProfileOpinions";
import { ProfileGovernoIdeale } from "./components/ProfileGovernoIdeale";

// Hook personalizzato
import { useProfileData } from "./hooks/useProfileData";

// Types
import { UserInfo } from "@/types/profile";

interface ProfiloProps {
  userId?: string;
}

export default function Profilo({ userId }: ProfiloProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);

  // Hook personalizzato per la gestione dei dati del profilo
  const {
    userInfo,
    isLoadingInfo,
    error,
    userOpinions,
    avatarConfig,
    governoIdeale,
    opinionQuestions,
    fetchAllProfileData,
    isLoading,
    authReady
  } = useProfileData(userId);

  const fromGestisciUtenti = typeof window !== 'undefined' && 
    (window.location.search.includes('from=utenti') || window.location.hash.includes('from=utenti'));

  // Gestione modifica immagine
  const handleModificaImmagine = () => {
    setLocation('/modifica-immagine');
  };

  // Gestione salvataggio profilo
  const handleSaveProfile = async (updatedData: any) => {
    try {
      toast({
        title: "Successo",
        description: "Profilo aggiornato con successo!",
      });
      setIsEditing(false);
      // Ricarica i dati del profilo
      await fetchAllProfileData();
    } catch (error) {
      console.error('Errore nel salvataggio del profilo:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nel salvataggio del profilo",
        variant: "destructive",
      });
    }
  };

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl space-y-4">
        {/* Stati di caricamento e errore */}
        <ProfileLoadingStates
          isLoading={isLoading}
          isLoadingInfo={isLoadingInfo}
          error={error}
          onRetry={fetchAllProfileData}
        />

        {/* Contenuto principale */}
        {userInfo && !isLoading && !isLoadingInfo && !error && (
          <>
            {/* Form di modifica o informazioni del profilo */}
            {isEditing && userInfo ? (
              <EditProfileForm
                userData={{...userInfo, uid: userInfo.id || ''}}
                onProfileUpdated={handleSaveProfile}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <ProfileInfo
                userInfo={userInfo}
                isEditing={isEditing}
                onEditClick={() => setIsEditing(true)}
                onModificaImmagine={handleModificaImmagine}
              />
            )}

            {/* Sezione opinioni */}
            <ProfileOpinions
              userOpinions={userOpinions}
              opinionQuestions={opinionQuestions}
            />

            {/* Sezione governo ideale */}
            <ProfileGovernoIdeale governoIdeale={governoIdeale} />

            {/* Sezione rappresentanti */}
            {userInfo && (
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-6">
                  <ProfileRepresentatives userInfo={userInfo} />
                </div>
              </div>
            )}

            {/* Sezione candidati */}
            {userInfo && (
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-6">
                  <ProfileCandidates userInfo={userInfo} />
                </div>
              </div>
            )}
          </>
        )}

        {/* Messaggio se nessuna informazione trovata */}
        {!userInfo && !isLoading && !isLoadingInfo && !error && (
          <div className="text-center p-4">
            Nessuna informazione trovata.
          </div>
        )}
      </div>
    </div>
  );
}
