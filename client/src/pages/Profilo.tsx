import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Edit, User, Image } from "lucide-react";
import { auth } from "@/lib/firebase-stub";
import { EditProfileForm } from "@/components/EditProfileForm";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { UserInfo } from "@/types/profile";

// === AGGIUNTO ===
// Importa i componenti che sostituiscono le parti rimosse
import { ProfileRepresentatives } from "@/components/ProfileRepresentatives";
import { ProfileCandidates } from "@/components/ProfileCandidates";

// --- LASCIATO IDENTICO ---
export default function Profilo({ userId }: { userId?: string }) {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userOpinions, setUserOpinions] = useState<Record<string, string>>({});
  
  // === CANCELLATO ===
  // const [representativeNames, setRepresentativeNames] = useState<Record<string, string>>({});
  // const [representativeAvatars, setRepresentativeAvatars] = useState<Record<string, any>>({});
  // const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  // const [candidateAvatars, setCandidateNames] = useState<Record<string, any>>({});
  
  // --- LASCIATO IDENTICO ---
  const [avatarConfig, setAvatarConfig] = useState<any>(null);
  const [governoIdeale, setGovernoIdeale] = useState<Record<string, string>>({});
  const [, setLocation] = useLocation();
  const [opinionQuestions, setOpinionQuestions] = useState<{id: string, text: string}[]>([]);

  const fromGestisciUtenti = typeof window !== 'undefined' && (window.location.search.includes('from=utenti') || window.location.hash.includes('from=utenti'));

  // === RIFATTORIZZATO ===
  // Funzione unificata per caricare tutti i dati del profilo
  const fetchAllProfileData = async () => {
    if (!user) return;
    
    setIsLoadingInfo(true);
    setError(null);
    
    try {
      console.log('🔍 DEBUG Profilo - Iniziando caricamento dati profilo...');
      
      // 1. Carica dati utente
      console.log('🔍 DEBUG Profilo - Caricando dati utente...');
      const userResponse = await apiRequest("GET", "/utenti/me");
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
        const opinionsResponse = await apiRequest("GET", "/opinioni/profile");
        if (opinionsResponse.ok) {
          const opinionsResult = await opinionsResponse.json();
          console.log('🔍 DEBUG Profilo - Risposta opinioni:', opinionsResult);
          if (opinionsResult.success && opinionsResult.data) {
            setOpinionQuestions(Array.isArray(opinionsResult.data.questions) ? opinionsResult.data.questions : []);
            // Aggiorna anche le opinioni dell'utente
            if (opinionsResult.data.userAnswers) {
              setUserOpinions(prev => ({ ...prev, ...opinionsResult.data.userAnswers }));
              console.log('🔍 DEBUG Profilo - Opinion dinamiche caricate:', opinionsResult.data.userAnswers);
            }
          }
        }
      } catch (opinionsError) {
        console.warn('⚠️ Avviso: Errore nel caricamento opinioni (non critico):', opinionsError);
        // Non bloccare il caricamento per questo errore
      }
      
      // 4. Carica governo ideale
      console.log('🔍 DEBUG Profilo - Caricando governo ideale...');
      try {
        const governoResponse = await apiRequest("GET", "/governo/voti");
        if (governoResponse.ok) {
          const governoResult = await governoResponse.json();
          if (governoResult.success && governoResult.voti) {
            const voti = governoResult.voti;
            const votiGoverno: Record<string, string> = {};
            
            // Converti i voti in un oggetto categoria -> candidato
            voti.forEach((voto: any) => {
              if (voto.categoria && voto.nome_ministro) {
                votiGoverno[voto.categoria] = voto.nome_ministro;
              }
            });
            
            setGovernoIdeale(votiGoverno);
          }
        }
      } catch (governoError) {
        console.warn('⚠️ Avviso: Errore nel caricamento governo (non critico):', governoError);
        // Non bloccare il caricamento per questo errore
      }
      
      // 5. Carica configurazione avatar
      if (userData.avatar_config) {
        try {
          const config = JSON.parse(userData.avatar_config);
          const updatedConfig = {
            skinColor: config.skinColor || "#FDBCB4",
            hairColor: config.hairColor || "#8B4513",
            hairStyle: config.hairStyle || "short",
            mustacheStyle: config.mustacheStyle || (config.mustache ? "classic" : "none"),
            mustacheColor: config.mustacheColor || "#2C3E50",
            beardStyle: config.beardStyle || "none",
            beardColor: config.beardColor || "#2C3E50",
            noseStyle: config.noseStyle || "normal",
            suitColor: config.suitColor || "#2C3E50",
            tieColor: config.tieColor || "#E74C3C"
          };
          setAvatarConfig(updatedConfig);
        } catch (error) {
          console.error("Errore nel parsing della configurazione avatar:", error);
        }
      }
      
      console.log('✅ DEBUG Profilo - Caricamento completato con successo');
      
    } catch (error) {
      console.error('❌ DEBUG Profilo - Errore nel caricamento:', error);
      setError(error instanceof Error ? error.message : "Errore nel caricamento dei dati del profilo");
      setUserInfo(null);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // === RIFATTORIZZATO ===
  // useEffect unificato per caricare i dati quando l'utente è disponibile
  useEffect(() => {
    if (user && authReady) {
      fetchAllProfileData();
    } else if (!user && !isLoading) {
      setIsLoadingInfo(false);
    }
  }, [user, authReady]);

  // === CANCELLATO ===
  // const fetchRepresentativeNames = async (userInfo: any) => { ... };
  // const fetchCandidateNames = async (userInfo: any) => { ... };

  // === CANCELLATO ===
  // const fetchGovernoIdeale = async () => { ... };

  // === CANCELLATO ===
  // useEffect separato per fetchUserInfo

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (!authReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <div>Caricamento autenticazione...</div>
      </div>
    );
  }

  // --- LASCIATO IDENTICO --- (Logica per le opinioni)
  const allOpinionKeys = Array.from(new Set([
    ...(Array.isArray(opinionQuestions) ? opinionQuestions.map(q => q.id) : []),
    ...Object.keys(userOpinions)
  ]));

  const getOpinionLabel = (id: string) => {
    const q = opinionQuestions.find(q => q.id === id);
    return q ? q.text : id;
  };

  // Mappatura degli ID delle opinioni ai loro argomenti
  const getOpinionTopic = (id: string, questionText: string): string => {
    // Mappatura per le opinioni base
    const baseOpinionsMap: Record<string, string> = {
      'energia_nucleare': 'Energia Nucleare',
      'sperimentazione_animale': 'Sperimentazione Animale',
      'legalizzazione_canapa': 'Legalizzazione Canapa',
      'caccia': 'Caccia',
      'cittadina_animale': 'Cittadinanza Animale',
      'eutanasia': 'Eutanasia',
      'case_chiuse': 'Case Chiuse',
      'salario_minimo': 'Salario Minimo',
      'matrimonio_gay': 'Matrimonio Gay',
      'nato': 'NATO',
      'omobitransfobia': 'Legge contro l\'omobitransfobia'
    };
    
    // Se è un'opinione base, usa la mappatura
    if (baseOpinionsMap[id]) {
      return baseOpinionsMap[id];
    }
    
    // Per le opinioni dinamiche, estrai l'argomento dalla domanda
    if (questionText) {
      // Rimuovi "Sei favorevole a" o "Sei favorevole alla" dall'inizio
      let topic = questionText.replace(/^Sei favorevole (a|alla) /i, '');
      
      // Rimuovi il punto interrogativo alla fine
      topic = topic.replace(/\?$/, '');
      
      // Capitalizza la prima lettera
      topic = topic.charAt(0).toUpperCase() + topic.slice(1);
      
      return topic;
    }
    
    // Fallback: usa l'ID
    return id;
  };

  const categorizeAllOpinions = () => {
    const favorevoli: { id: string, label: string }[] = [];
    const indecisi: { id: string, label: string }[] = [];
    const contrari: { id: string, label: string }[] = [];
    allOpinionKeys.forEach((key) => {
      const value = userOpinions[key];
      if (!value) return;
      const q = Array.isArray(opinionQuestions) ? opinionQuestions.find(q => q.id === key) : null;
      const label = getOpinionTopic(key, q?.text || '');
      if (value === "Favorevole") favorevoli.push({ id: key, label });
      else if (value === "Indeciso") indecisi.push({ id: key, label });
      else if (value === "Contrario") contrari.push({ id: key, label });
    });
    return { favorevoli, indecisi, contrari };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-4">
      <div className="container mx-auto max-w-4xl space-y-4">
        {/* === RIFATTORIZZATO === */}
        {/* Gestione stati di caricamento e errore unificata */}
        {isLoading || isLoadingInfo ? (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg text-gray-600">Caricamento profilo...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-red-300">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-2 text-red-700">Errore nel caricamento</h2>
              <p className="text-gray-700 mb-4">{error}</p>
              <Button 
                onClick={fetchAllProfileData}
                className="bg-red-600 hover:bg-red-700"
              >
                Riprova
              </Button>
            </div>
          </div>
        ) : userInfo && user ? (
          <>
            {console.log('🔍 DEBUG Profilo - Rendering con userInfo:', userInfo)}
            {console.log('🔍 DEBUG Profilo - userInfo.nome:', userInfo.nome)}
            {console.log('🔍 DEBUG Profilo - userInfo.cittadinanza:', userInfo.cittadinanza)}
            {console.log('🔍 DEBUG Profilo - userInfo.paese_residenza:', userInfo.paese_residenza)}
            <Button 
              variant="ghost" 
              className="mb-4 flex items-center"
              onClick={() => setLocation(fromGestisciUtenti ? "/gestisci-utenti" : (userId ? "/gestisci-grazia" : "/menu"))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {fromGestisciUtenti ? "Torna a Gestisci Utenti" : userId ? "Torna a Gestisci Grazia" : "Torna al Menu"}
            </Button>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  Profilo Utente
                </CardTitle>
                <CardDescription>
                  {userId ? "Visualizza le informazioni di questo utente" : "Visualizza e gestisci le tue informazioni personali"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                    <EditProfileForm 
                      userData={{...userInfo, uid: user.id}} 
                      onProfileUpdated={async () => {
                        toast({
                          title: "Profilo aggiornato",
                          description: "Il profilo è stato aggiornato con successo",
                        });
                        setIsEditing(false);
                        // Ricarica i dati dopo la modifica
                        await fetchAllProfileData();
                      }}
                      onCancel={() => setIsEditing(false)}
                    />
                ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Informazioni personali</h3>
                        <div className="space-y-2">
                          <p><strong>Nome:</strong> {userInfo.nome}</p>
                          <p><strong>Cognome:</strong> {userInfo.cognome}</p>
                          <p><strong>Data di nascita:</strong> {userInfo.data_nascita}</p>
                          <p><strong>Genere:</strong> {userInfo.genere}</p>
                          <p><strong>Cittadinanza:</strong> {userInfo.cittadinanza}</p>
                          <p><strong>Ruolo:</strong> {userInfo.ruolo}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium mb-2">Residenza</h3>
                        <div className="space-y-2">
                          <p><strong>Paese:</strong> {userInfo.paese_residenza}</p>
                          <p><strong>Regione:</strong> {userInfo.regione_residenza}</p>
                          <p><strong>Provincia:</strong> {userInfo.provincia_residenza}</p>
                          <p><strong>Comune:</strong> {userInfo.comune_residenza}</p>
                        </div>
                        
                        {userInfo.paese_elezione && (
                          <>
                            <h3 className="text-lg font-medium mt-4 mb-2">Elezione</h3>
                            <div className="space-y-2">
                              <p><strong>Paese:</strong> {userInfo.paese_elezione}</p>
                              <p><strong>Regione:</strong> {userInfo.regione_elezione}</p>
                              <p><strong>Provincia:</strong> {userInfo.provincia_elezione}</p>
                              <p><strong>Comune:</strong> {userInfo.comune_elezione}</p>
                              <p><strong>Grado:</strong> {userInfo.grado_elezione}</p>
                            </div>
                          </>
                        )}
                        
                        {userInfo.paese_candidatura && (
                          <>
                            <h3 className="text-lg font-medium mt-4 mb-2">Candidatura</h3>
                            <div className="space-y-2">
                              <p><strong>Paese:</strong> {userInfo.paese_candidatura}</p>
                              <p><strong>Regione:</strong> {userInfo.regione_candidatura}</p>
                              <p><strong>Provincia:</strong> {userInfo.provincia_candidatura}</p>
                              <p><strong>Comune:</strong> {userInfo.comune_candidatura}</p>
                              <p><strong>Grado:</strong> {userInfo.grado_candidatura}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {!isEditing && (
                  <>
                    {(userInfo.ruolo === 'Politico' || userInfo.ruolo === 'Candidato' || userInfo.ruolo === 'Candidato Politico') && (
                      <Button variant="outline" onClick={() => window.location.href = `/modifica-immagine?uid=${user.id}`}>
                        <Image className="mr-2 h-4 w-4" />
                        Modifica Immagine
                      </Button>
                    )}
                    <Button onClick={() => setIsEditing(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Modifica Profilo
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>

            {/* --- SEZIONE OPINIONI LASCIATA IDENTICA --- */}
            {userInfo && userOpinions && Object.keys(userOpinions).length > 0 && (
              <Card className="animate-in-delay">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Le Tue Opinioni Politiche</CardTitle>
                  <CardDescription>Visualizzazione delle tue posizioni sui temi principali</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-6">
                    <div className="space-y-3">
                      <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div>Favorevole</h3>
                        <div className="space-y-2">
                          {categorizeAllOpinions().favorevoli.length > 0 ? (
                            categorizeAllOpinions().favorevoli.map(({ id, label }) => (
                              <div key={id} className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between"><span className="text-green-800 font-medium">{label}</span></div>
                            ))
                          ) : <div className="text-green-600 text-sm italic">Nessuna opinione favorevole</div>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div>Indeciso</h3>
                        <div className="space-y-2">
                          {categorizeAllOpinions().indecisi.length > 0 ? (
                            categorizeAllOpinions().indecisi.map(({ id, label }) => (
                              <div key={id} className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-center justify-between"><span className="text-yellow-800 font-medium">{label}</span></div>
                            ))
                          ) : <div className="text-yellow-600 text-sm italic">Nessuna opinione indecisa</div>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                        <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Contrario</h3>
                        <div className="space-y-2">
                          {categorizeAllOpinions().contrari.length > 0 ? (
                            categorizeAllOpinions().contrari.map(({ id, label }) => (
                              <div key={id} className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center justify-between"><span className="text-red-800 font-medium">{label}</span></div>
                            ))
                          ) : <div className="text-red-600 text-sm italic">Nessuna opinione contraria</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- SEZIONE GOVERNO IDEALE LASCIATA IDENTICA --- */}
            {userInfo && Object.keys(governoIdeale).length > 0 && (
              <Card className="animate-in-delay">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Il Tuo Governo Ideale</CardTitle>
                  <CardDescription>I ministri che hai selezionato per il tuo governo ideale</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(governoIdeale).map(([categoria, nome]) => (
                      <div key={categoria} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-800 mb-2 capitalize">{categoria.replace(/_/g, ' ')}</h3>
                        <div className="bg-white border border-blue-200 rounded-md p-3">
                          <span className="text-blue-900 font-medium">{nome as string}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* === CANCELLATO === */}
            {/* Il blocco JSX per i Rappresentanti è stato rimosso */}
            {/* Il blocco JSX per i Candidati è stato rimosso */}

            {/* === AGGIUNTO === */}
            {/* Aggiungiamo le chiamate ai nuovi componenti */}
            {userInfo && (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <ProfileRepresentatives userInfo={userInfo} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <ProfileCandidates userInfo={userInfo} />
                  </CardContent>
                </Card>
              </>
            )}
          </>
        ) : (
          <div className="text-center p-4">Nessuna informazione trovata.</div>
        )}
      </div>
    </div>
  );
}