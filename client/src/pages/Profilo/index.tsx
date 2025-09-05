import { useState } from "react";
import { Redirect, useLocation, useParams } from "wouter";
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

export default function Profilo({ userId: propUserId }: ProfiloProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const [isEditing, setIsEditing] = useState(false);
  
  // Estrai userId dall'URL o dalla prop
  const userId = propUserId || params.userId;

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
  
  // Determina se l'utente sta visualizzando il proprio profilo o quello di un altro
  const isViewingOwnProfile = !userId || userId === user?.id;
  const isViewingOtherProfile = userId && userId !== user?.id;

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

        {/* Messaggio informativo quando si visualizza il profilo di un altro utente */}
        {isViewingOtherProfile && userInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Visualizzazione profilo di {userInfo.nome} {userInfo.cognome}
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Stai visualizzando il profilo di un altro utente. La modifica non è disponibile.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contenuto principale */}
        {userInfo && !isLoading && !isLoadingInfo && !error && (
          <>
            {/* Form di modifica o informazioni del profilo */}
            {isEditing && userInfo && isViewingOwnProfile ? (
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
                canEdit={isViewingOwnProfile}
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
