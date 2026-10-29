import { useState } from "react";
import { Link, Redirect, useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { EditProfileForm } from "@/components/EditProfileForm";
import { ProfileRepresentatives } from "@/components/ProfileRepresentatives";
import { ProfileCandidates } from "@/components/ProfileCandidates";
import { PageContainer } from "@/components/PageContainer";
import { Settings } from "lucide-react";

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
    rappresentantiDetails,
    candidatiDetails,
    fetchAllProfileData,
    isLoading,
    authReady
  } = useProfileData(userId);

  // Determina se l'utente sta visualizzando il proprio profilo o quello di un altro
  const isViewingOwnProfile = !userId || userId === user?.id;
  const isViewingOtherProfile = Boolean(userId && userId !== user?.id);

  // Il dato arriva dalla cache React Query legata all'account, non dal vecchio
  // profilo_locale globale (che poteva inserire dati di un altro account).
  const displayUserInfo: UserInfo | null = userInfo;

  // Gestione modifica immagine
  const handleModificaImmagine = () => {
    setLocation('/modifica-immagine');
  };


  // Il salvataggio invalida già la cache tramite apiRequest: non ricaricarla
  // una seconda volta e non mostrare due toast per lo stesso risultato.
  const handleSaveProfile = () => {
    setIsEditing(false);
  };

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-none px-3 sm:px-4 lg:px-8 py-4">
        {/* Header decorativo */}
        <div className="relative mb-4">
          {/* Background decorative elements */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-10 blur-xl"></div>
          <div className="absolute -top-2 -right-4 w-16 h-16 bg-gradient-to-br from-pink-400 to-orange-500 rounded-full opacity-10 blur-xl"></div>
          
          <div className="relative flex justify-end mb-2">
            {isViewingOwnProfile && (
              <Link href="/impostazioni" className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-indigo-50">
                <Settings className="h-4 w-4" /> Impostazioni
              </Link>
            )}
          </div>
          <div className="relative text-center">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent mb-2">
              Profilo Utente
            </h1>
            <p className="text-gray-600 text-sm">
              {isViewingOwnProfile ? 'Il tuo profilo personale' : `Profilo di ${userInfo?.nome || 'Utente'}`}
            </p>
          </div>
        </div>

        <div className="space-y-4">
        {/* Stati di caricamento e errore */}
        <ProfileLoadingStates
          isLoading={isLoading}
          isLoadingInfo={isLoadingInfo}
          error={error}
          onRetry={fetchAllProfileData}
        />

        {/* Messaggio informativo quando si visualizza il profilo di un altro utente */}
        {isViewingOtherProfile && userInfo && (
          <div className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative flex items-center">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-blue-900">
                  Visualizzazione profilo di {userInfo.nome} {userInfo.cognome}
                </h3>
                <div className="mt-1 text-blue-700">
                  <p>Stai visualizzando il profilo di un altro utente. La modifica non è disponibile.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contenuto principale */}
        {displayUserInfo && !isLoading && !isLoadingInfo && !error && (
          <>
            {/* Form di modifica a larghezza piena */}
            {isEditing && displayUserInfo ? (
              <EditProfileForm
                userData={{...displayUserInfo, uid: displayUserInfo.id || ''}}
                onProfileUpdated={handleSaveProfile}
                onCancel={() => setIsEditing(false)}
                isAdmin={user?.ruolo === "AD"}
              />
            ) : (
              /* Desktop (lg+): 3 colonne | Mobile: stack verticale */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 items-start">
                {/* Colonna 1: Informazioni Profilo */}
                <div className="min-w-0">
                  <ProfileInfo
                    userInfo={displayUserInfo}
                    isEditing={isEditing}
                    onEditClick={() => setIsEditing(true)}
                    onModificaImmagine={handleModificaImmagine}
                    canEdit={isViewingOwnProfile}
                    isOwnProfile={isViewingOwnProfile}
                    avatarConfig={avatarConfig}
                  />
                </div>

                {/* Colonna 2: Rappresentanti + Candidati */}
                <div className="min-w-0 space-y-3">
                  {userInfo && userInfo.ruolo !== "I" && (
                    <div className="relative overflow-hidden border-0 shadow-md bg-white rounded-2xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-full -translate-y-16 translate-x-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-400/20 to-cyan-500/20 rounded-full translate-y-12 -translate-x-12"></div>
                      <div className="relative p-4 lg:p-5">
                        <ProfileRepresentatives 
                          userInfo={userInfo} 
                          rappresentantiDetails={rappresentantiDetails}
                          canEditSelections={isViewingOwnProfile}
                        />
                      </div>
                    </div>
                  )}

                  {userInfo && userInfo.ruolo !== "I" && (
                    <div className="relative overflow-hidden border-0 shadow-md bg-white rounded-2xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full -translate-y-16 translate-x-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-orange-400/20 to-red-500/20 rounded-full translate-y-12 -translate-x-12"></div>
                      <div className="relative p-4 lg:p-5">
                        <ProfileCandidates 
                          userInfo={userInfo} 
                          candidatiDetails={candidatiDetails}
                          canEditSelections={isViewingOwnProfile}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Colonna 3: Il Tuo Governo Ideale */}
                <div className="min-w-0">
                  <ProfileGovernoIdeale governoIdeale={governoIdeale} canEdit={isViewingOwnProfile} />
                </div>
              </div>
            )}

            {/* Sezione opinioni - larghezza piena sotto le colonne */}
            <ProfileOpinions
              userOpinions={userOpinions}
              opinionQuestions={opinionQuestions}
            />
          </>
        )}

        {/* Messaggio se nessuna informazione trovata */}
        {!userInfo && !isLoading && !isLoadingInfo && !error && (
          <div className="text-center p-12">
            <div className="relative overflow-hidden border-0 shadow-lg bg-white rounded-2xl p-8">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-gray-400/20 to-blue-500/20 rounded-full -translate-y-10 translate-x-10"></div>
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna informazione trovata</h3>
                <p className="text-gray-600">Non sono disponibili informazioni per questo profilo.</p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </PageContainer>
  );
}
