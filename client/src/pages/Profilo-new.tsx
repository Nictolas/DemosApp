import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { UserInfo } from "@/types/profile";
import { ProfileRepresentatives } from "@/components/ProfileRepresentatives";
import { ProfileCandidates } from "@/components/ProfileCandidates";
import { 
  ProfileHeader, 
  ProfileInfo, 
  ProfileOpinions, 
  ProfileGovernment, 
  ProfileLoading, 
  ProfileError,
  canEditImage
} from "@/components/profilo";
import { Card, CardContent } from "@/components/ui/card";

export default function Profilo({ userId }: { userId?: string }) {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userOpinions, setUserOpinions] = useState<Record<string, string>>({});
  const [avatarConfig, setAvatarConfig] = useState<any>(null);
  const [governoIdeale, setGovernoIdeale] = useState<Record<string, string>>({});
  const [, setLocation] = useLocation();
  const [opinionQuestions, setOpinionQuestions] = useState<{id: string, text: string}[]>([]);

  const fromGestisciUtenti = typeof window !== 'undefined' && (window.location.search.includes('from=utenti') || window.location.hash.includes('from=utenti'));

  // Funzione unificata per caricare tutti i dati del profilo
  const fetchAllProfileData = async () => {
    if (!user) return;
    
    setIsLoadingInfo(true);
    setError(null);
    
    try {
      console.log('🔍 DEBUG Profilo - Iniziando caricamento dati profilo...');
      
      // 1. Carica dati utente
      console.log('🔍 DEBUG Profilo - Caricando dati utente...');
      const userResponse = await apiRequest("GET", "/api/users/me");
      if (!userResponse.ok) {
        throw new Error(`Errore nel caricamento dati utente: ${userResponse.status}`);
      }
      
      const userResult = await userResponse.json();
      console.log('🔍 DEBUG Profilo - Risposta API utente:', userResult);
      
      if (!userResult.success) {
        throw new Error(userResult.message || 'Errore nel caricamento dati utente');
      }
      
      const userData = userResult.user || userResult.data || userResult;
      console.log('🔍 DEBUG Profilo - Dati utente estratti:', userData);
      
      setUserInfo(userData as UserInfo);
      console.log('🔍 DEBUG Profilo - userInfo impostato:', userData);
      
      // 2. Carica opinioni utente
      console.log('🔍 DEBUG Profilo - Caricando opinioni utente...');
      const userOpinionsData: Record<string, string> = {};
      
      // Opinion base dal database
      const baseOpinions = ['energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa', 'caccia'];
      baseOpinions.forEach(opinion => {
        if (userData[opinion]) {
          userOpinionsData[opinion] = userData[opinion];
          console.log(`🔍 DEBUG Profilo - Opinione ${opinion}: ${userData[opinion]}`);
        }
      });
      
      setUserOpinions(userOpinionsData);
      console.log('🔍 DEBUG Profilo - Opinion base caricate:', userOpinionsData);
      
      // 3. Carica domande opinioni
      console.log('🔍 DEBUG Profilo - Caricando domande opinioni...');
      try {
        const opinionsResponse = await apiRequest("GET", "/api/opinioni/profile");
        if (opinionsResponse.ok) {
          const opinionsResult = await opinionsResponse.json();
          console.log('🔍 DEBUG Profilo - Risposta opinioni:', opinionsResult);
          if (opinionsResult.success && opinionsResult.data) {
            setOpinionQuestions(Array.isArray(opinionsResult.data.questions) ? opinionsResult.data.questions : []);
            // Aggiorna anche le opinioni dell'utente
            if (opinionsResult.data.userOpinions) {
              setUserOpinions(prev => ({ ...prev, ...opinionsResult.data.userOpinions }));
            }
          }
        }
      } catch (opinionsError) {
        console.warn('⚠️ DEBUG Profilo - Errore nel caricamento opinioni (non critico):', opinionsError);
      }
      
      // 4. Carica governo ideale
      console.log('🔍 DEBUG Profilo - Caricando governo ideale...');
      try {
        const governoResponse = await apiRequest("GET", "/api/governo-ideale");
        if (governoResponse.ok) {
          const governoResult = await governoResponse.json();
          if (governoResult.success && governoResult.data) {
            setGovernoIdeale(governoResult.data);
          }
        }
      } catch (governoError) {
        console.warn('⚠️ DEBUG Profilo - Errore nel caricamento governo ideale (non critico):', governoError);
      }
      
      console.log('🔍 DEBUG Profilo - Caricamento completato con successo!');
      
    } catch (error) {
      console.error('❌ DEBUG Profilo - Errore nel caricamento:', error);
      setError(error instanceof Error ? error.message : 'Errore sconosciuto nel caricamento del profilo');
    } finally {
      setIsLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (authReady && user) {
      fetchAllProfileData();
    }
  }, [authReady, user]);

  const handleModificaImmagine = () => {
    setLocation('/modifica-immagine');
  };

  const handleBack = () => {
    if (fromGestisciUtenti) {
      setLocation("/utenti");
    } else if (userId) {
      setLocation("/gestisci-grazia");
    } else {
      setLocation("/menu");
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleProfileUpdated = async () => {
    toast({
      title: "Profilo aggiornato",
      description: "Il profilo è stato aggiornato con successo",
    });
    setIsEditing(false);
    // Ricarica i dati dopo la modifica
    await fetchAllProfileData();
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-100 to-blue-400 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl space-y-4">
        {/* Gestione stati di caricamento e errore unificata */}
        <ProfileLoading isLoading={isLoading} isLoadingInfo={isLoadingInfo} />
        
        <ProfileError error={error} onRetry={fetchAllProfileData} />

        {userInfo && user && !isLoading && !isLoadingInfo && !error && (
          <>
            <ProfileHeader 
              fromGestisciUtenti={fromGestisciUtenti}
              userId={userId}
              onBack={handleBack}
            />
            
            <ProfileInfo 
              userInfo={userInfo}
              isEditing={isEditing}
              onEdit={handleEdit}
              onModificaImmagine={handleModificaImmagine}
              canEditImage={canEditImage(userInfo.ruolo)}
            />

            {/* Sezione Opinioni */}
            <ProfileOpinions 
              userOpinions={userOpinions}
              opinionQuestions={opinionQuestions}
            />

            {/* Sezione Governo Ideale */}
            <ProfileGovernment governoIdeale={governoIdeale} />

            {/* Componenti esistenti */}
            <Card className="bg-white">
              <CardContent className="pt-6">
                <ProfileRepresentatives userInfo={userInfo} />
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <ProfileCandidates userInfo={userInfo} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
