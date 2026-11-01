import { useState } from "react";
import { Link, Redirect, useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { EditProfileForm } from "@/components/EditProfileForm";
import { ProfileRepresentatives } from "@/components/ProfileRepresentatives";
import { ProfileCandidates } from "@/components/ProfileCandidates";
import { PageContainer } from "@/components/PageContainer";
import { hasAdminCapability, hasDpoCapability } from "@/lib/admin-access";
import { ChevronDown, Settings, RefreshCcw } from "lucide-react";

// Componenti modulari
import { ProfileLoadingStates } from "./components/ProfileLoadingStates";
import { ProfileInfo } from "./components/ProfileInfo";
import { ProfileOpinions } from "./components/ProfileOpinions";
import { PoliticalCompassPreview } from "./components/PoliticalCompassPreview";
import { ProfileGovernoIdeale } from "./components/ProfileGovernoIdeale";
import { ProfileChosenPreferences, type ChosenPreferencesStatus } from "./components/ProfileChosenPreferences";

// Hook personalizzato
import { useProfileData, CLOSED_PROFILE_PANELS, type ProfilePanels } from "./hooks/useProfileData";

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
  const [openPanels, setOpenPanels] = useState<ProfilePanels>(CLOSED_PROFILE_PANELS);
  const setPanel = (key: keyof ProfilePanels, expanded: boolean) =>
    setOpenPanels((current) => ({ ...current, [key]: expanded }));
  
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
    sectionsLoading,
    chosenVotes,
    chosenVotesLoading,
    chosenVotesError,
    consentGranted,
    consentChecked,
    fetchAllProfileData,
    isLoading,
    authReady
  } = useProfileData(userId, { ...openPanels, edit: isEditing });

  // Determina se l'utente sta visualizzando il proprio profilo o quello di un altro
  const isViewingOwnProfile = !userId || userId === user?.id;
  const isViewingOtherProfile = Boolean(userId && userId !== user?.id);

  const chosenPreferencesStatus: ChosenPreferencesStatus =
    !consentChecked ? "loading" :
    !consentGranted ? "consent-required" :
    chosenVotesLoading ? "loading" :
    chosenVotesError || !chosenVotes ? "unavailable" : "ready";

  // No shared profilo_locale: the hook restores only the allowlisted per-account
  // summary from device storage, never political answers or selection IDs.
  const displayUserInfo: UserInfo | null = userInfo;

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
    <PageContainer className="bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="flex min-h-0 h-full w-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white/95 px-3 pb-3 pt-3 sm:px-4 lg:px-8">
        {/* Header decorativo */}
        <div className="relative mb-3">
          {/* Background decorative elements */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-10 blur-xl"></div>
          <div className="absolute -top-2 -right-4 w-16 h-16 bg-gradient-to-br from-pink-400 to-orange-500 rounded-full opacity-10 blur-xl"></div>
          
          <div className="relative flex items-center gap-2 sm:gap-3 text-left">
            {isViewingOwnProfile && (
              (hasAdminCapability(user) || hasDpoCapability(user)) ? (
                <button
                  type="button"
                  onClick={() => setLocation("/gestisci")}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 hover:opacity-80"
                  title="Clicca per accedere alla sezione Gestisci"
                  aria-label="Vai a Gestisci"
                  data-testid="profilo-logo-gestisci"
                >
                  <img src="/icona.png" alt="Logo Demos" className="h-11 w-11 object-contain" />
                </button>
              ) : (
                <img src="/icona.png" alt="Logo Demos" className="h-11 w-11 shrink-0 object-contain" data-testid="profilo-logo" />
              )
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Profilo Cittadino
              </h1>
              <p className="text-gray-600 text-sm">
                {isViewingOwnProfile ? 'Il tuo profilo personale' : 'Profilo pubblico'}
              </p>
            </div>
            {isViewingOwnProfile && (
              <button
                type="button"
                onClick={() => void fetchAllProfileData()}
                aria-label="Sincronizza manualmente il profilo e le sue sezioni"
                title="Sincronizza profilo"
                data-testid="profilo-sincronizza-icon"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <RefreshCcw aria-hidden="true" className="h-5 w-5" />
              </button>
            )}
            {isViewingOwnProfile && (
              <Link
                href="/impostazioni"
                aria-label="Apri impostazioni"
                title="Impostazioni"
                data-testid="profilo-impostazioni-icon"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <Settings aria-hidden="true" className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>

        {!isEditing && displayUserInfo && !isLoading && !isLoadingInfo && !error && (
          <div className="mx-auto w-full max-w-6xl">
            <ProfileInfo
              userInfo={displayUserInfo}
              isEditing={false}
              onEditClick={() => setIsEditing(true)}
              onModificaImmagine={handleModificaImmagine}
              canEdit={isViewingOwnProfile}
              isOwnProfile={isViewingOwnProfile}
              avatarConfig={avatarConfig}
            />
          </div>
        )}
        </div>

        {/* Scorre soltanto il contenuto sotto l'intestazione e i dati di base. */}
        <section className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3 sm:px-4 lg:px-8" role="region" aria-label="Sezioni del profilo" tabIndex={0}>
        <div className="space-y-4">
        {/* Stati di caricamento e errore */}
        <ProfileLoadingStates
          isLoading={isLoading}
          isLoadingInfo={isLoadingInfo}
          error={error}
          onRetry={fetchAllProfileData}
        />

        {isViewingOtherProfile && userInfo && (
          <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Profilo pubblico · sola lettura
          </p>
        )}

        {/* Contenuto principale */}
        {displayUserInfo && !isLoading && !isLoadingInfo && !error && (
          <>
            {/* Form di modifica a larghezza piena */}
            {isEditing && displayUserInfo ? (
              sectionsLoading.personal ? (
                <p role="status" className="rounded-xl bg-white p-4 text-sm text-slate-600">Caricamento dati per la modifica…</p>
              ) : <EditProfileForm
                userData={{...displayUserInfo, uid: displayUserInfo.id || ''}}
                onProfileUpdated={handleSaveProfile}
                onCancel={() => setIsEditing(false)}
                isAdmin={user?.ruolo === "AD"}
              />
            ) : (
              /* Desktop (lg+): 3 colonne | Mobile: stack verticale */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5 items-start">
                {/* Mobile: le selezioni restano consultabili ma non allungano il profilo. */}
                <div className="min-w-0 space-y-3">
                  {isViewingOwnProfile && userInfo && userInfo.ruolo !== "I" && (
                    <details onToggle={(event) => setPanel("representatives", event.currentTarget.open)} className="group rounded-xl border border-slate-100 bg-white shadow-sm">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
                        Rappresentanti selezionati
                        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                        <Link href="/rappresentanti" className="mb-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">
                          Scegli Rappresentanti
                        </Link>
                        {sectionsLoading.representatives ? (
                          <p role="status" className="text-sm text-slate-500">Caricamento rappresentanti…</p>
                        ) : !consentGranted ? (
                          <p className="text-sm text-slate-500">Per visualizzare le selezioni è necessario il consenso politico.</p>
                        ) : (
                          <ProfileRepresentatives
                            userInfo={userInfo}
                            rappresentantiDetails={rappresentantiDetails}
                            canEditSelections={false}
                            showHeading={false}
                          />
                        )}
                      </div>
                    </details>
                  )}

                  {isViewingOwnProfile && userInfo && userInfo.ruolo !== "I" && (
                    <details onToggle={(event) => setPanel("candidates", event.currentTarget.open)} className="group rounded-xl border border-slate-100 bg-white shadow-sm">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
                        Candidati selezionati
                        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                        <Link href="/candidati" className="mb-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">
                          Scegli Candidati
                        </Link>
                        {sectionsLoading.candidates ? (
                          <p role="status" className="text-sm text-slate-500">Caricamento candidati…</p>
                        ) : !consentGranted ? (
                          <p className="text-sm text-slate-500">Per visualizzare le selezioni è necessario il consenso politico.</p>
                        ) : (
                          <ProfileCandidates
                            userInfo={userInfo}
                            candidatiDetails={candidatiDetails}
                            canEditSelections={false}
                            showHeading={false}
                          />
                        )}
                      </div>
                    </details>
                  )}
                </div>

                {/* Colonna 3: Il Tuo Governo Ideale */}
                <div className="min-w-0">
                  {isViewingOwnProfile && (
                    <ProfileGovernoIdeale
                      governoIdeale={governoIdeale}
                      onExpandedChange={(expanded) => setPanel("government", expanded)}
                      isLoading={sectionsLoading.government}
                      hasLoaded={openPanels.government && consentChecked}
                    />
                  )}
                </div>
              </div>
            )}

            {isViewingOwnProfile && (
              <ProfileChosenPreferences
                choices={consentGranted ? chosenVotes : null}
                status={chosenPreferencesStatus}
              />
            )}

            {/* Le opinioni restano accessibili senza un elenco lungo all'apertura. */}
            {isViewingOwnProfile && (
              <details onToggle={(event) => setPanel("opinions", event.currentTarget.open)} className="group rounded-xl border border-slate-100 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
                  Opinioni politiche · {Object.keys(userOpinions).length}
                  <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-slate-100 p-3">
                  <Link href="/opinioni" className="mb-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">
                    Esprimi opinioni
                  </Link>
                  {sectionsLoading.opinions ? (
                    <p role="status" className="text-sm text-slate-500">Caricamento opinioni…</p>
                  ) : !consentGranted ? (
                    <p className="text-sm text-slate-500">Per visualizzare le opinioni è necessario il consenso politico.</p>
                  ) : (
                    <>
                      <PoliticalCompassPreview answers={userOpinions} />
                      <ProfileOpinions userOpinions={userOpinions} opinionQuestions={opinionQuestions} />
                    </>
                  )}
                </div>
              </details>
            )}
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
        </section>
      </div>
    </PageContainer>
  );
}
