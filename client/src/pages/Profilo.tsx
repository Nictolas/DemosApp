import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Edit, User, Image } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { EditProfileForm } from "@/components/EditProfileForm";
import { CustomAvatar } from "@/components/CustomAvatar";
import { useToast } from "@/hooks/use-toast";

// Definizione locale del tipo UserInfo
export type UserInfo = {
  id?: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  genere: string;
  cittadinanza: string;
  ruolo: string;
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
  grado_elezione?: string;
  paese_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;
  grado_candidatura?: string;
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  unione_europea?: string;
  avatar_config?: string;
  status?: string;
  [key: string]: any;
};

export default function Profilo({ userId }: { userId?: string }) {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userOpinions, setUserOpinions] = useState<any>(null);
  const [representativeNames, setRepresentativeNames] = useState<Record<string, string>>({});
  const [representativeAvatars, setRepresentativeAvatars] = useState<Record<string, any>>({});
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [candidateAvatars, setCandidateAvatars] = useState<Record<string, any>>({});
  const [avatarConfig, setAvatarConfig] = useState<any>(null);
  const [governoIdeale, setGovernoIdeale] = useState<Record<string, string>>({});
  const [location, setLocation] = useLocation();

  // Ricavo la provenienza dalla query string (es: ?from=utenti)
  const fromGestisciUtenti = typeof window !== 'undefined' && (window.location.search.includes('from=utenti') || window.location.hash.includes('from=utenti'));

  // Funzione per categorizzare le opinioni
  const categorizeOpinions = (opinions: any) => {
    if (!opinions) return { favorevoli: [], indecisi: [], contrari: [] };

    const opinionLabels = {
      energia_nucleare: "Energia Nucleare",
      sperimentazione_animale: "Sperimentazione Animale", 
      legalizzazione_canapa: "Legalizzazione Canapa",
      caccia: "Caccia",
      unione_europea: "Unione Europea"
    };

    const favorevoli: string[] = [];
    const indecisi: string[] = [];
    const contrari: string[] = [];

    Object.entries(opinions).forEach(([key, value]) => {
      if (key in opinionLabels) {
        const label = opinionLabels[key as keyof typeof opinionLabels];
        if (value === "Favorevole") {
          favorevoli.push(label);
        } else if (value === "Indeciso") {
          indecisi.push(label);
        } else if (value === "Contrario") {
          contrari.push(label);
        }
      }
    });

    return { favorevoli, indecisi, contrari };
  };

  // Funzione per recuperare i nomi e avatar dei rappresentanti
  const fetchRepresentativeNames = async (userInfo: any) => {
    const representatives = {
      rappresentante_europeo: userInfo.rappresentante_europeo,
      rappresentante_camera: userInfo.rappresentante_camera,
      rappresentante_senato: userInfo.rappresentante_senato,
      rappresentante_regionale: userInfo.rappresentante_regionale,
      rappresentante_comunale: userInfo.rappresentante_comunale,
    };

    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};

    for (const [key, email] of Object.entries(representatives)) {
      if (email && typeof email === 'string') {
        try {
          const response = await fetch(`/api/users/${encodeURIComponent(email)}`);
          if (response.ok) {
            const userData = await response.json();
            names[key] = `${userData.nome} ${userData.cognome}`;
            
            // Carica l'avatar del rappresentante se disponibile
            if (userData.avatar_config) {
              try {
                const avatarConfig = JSON.parse(userData.avatar_config);
                // Converti le configurazioni legacy
                const updatedConfig = {
                  skinColor: avatarConfig.skinColor || "#FDBCB4",
                  hairColor: avatarConfig.hairColor || "#8B4513",
                  hairStyle: avatarConfig.hairStyle || "short",
                  mustacheStyle: avatarConfig.mustacheStyle || (avatarConfig.mustache ? "classic" : "none"),
                  mustacheColor: avatarConfig.mustacheColor || "#2C1810",
                  beardStyle: avatarConfig.beardStyle || "none",
                  beardColor: avatarConfig.beardColor || "#2C1810",
                  noseStyle: avatarConfig.noseStyle || "normal",
                  suitColor: avatarConfig.suitColor || "#2C3E50",
                  tieColor: avatarConfig.tieColor || "#E74C3C"
                };
                avatars[key] = updatedConfig;
              } catch (error) {
                console.error("Errore nel parsing dell'avatar del rappresentante:", error);
              }
            }
          } else {
            names[key] = email;
          }
        } catch (error) {
          console.error(`Errore nel recupero dati per ${email}:`, error);
          names[key] = email;
        }
      }
    }

    setRepresentativeNames(names);
    setRepresentativeAvatars(avatars);
  };

  // Funzione per recuperare i nomi e avatar dei candidati
  const fetchCandidateNames = async (userInfo: any) => {
    const candidates = {
      candidato_europeo: userInfo.candidato_europeo,
      candidato_camera: userInfo.candidato_camera,
      candidato_senato: userInfo.candidato_senato,
      candidato_regionale: userInfo.candidato_regione,
      candidato_comunale: userInfo.candidato_comune,
    };

    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};

    for (const [key, email] of Object.entries(candidates)) {
      if (email && typeof email === 'string') {
        try {
          const response = await fetch(`/api/users/${encodeURIComponent(email)}`);
          if (response.ok) {
            const userData = await response.json();
            names[key] = `${userData.nome} ${userData.cognome}`;
            
            // Carica l'avatar del candidato se disponibile
            if (userData.avatar_config) {
              try {
                const avatarConfig = JSON.parse(userData.avatar_config);
                // Converti le configurazioni legacy
                const updatedConfig = {
                  skinColor: avatarConfig.skinColor || "#FDBCB4",
                  hairColor: avatarConfig.hairColor || "#8B4513",
                  hairStyle: avatarConfig.hairStyle || "short",
                  mustacheStyle: avatarConfig.mustacheStyle || (avatarConfig.mustache ? "classic" : "none"),
                  mustacheColor: avatarConfig.mustacheColor || "#2C1810",
                  beardStyle: avatarConfig.beardStyle || "none",
                  beardColor: avatarConfig.beardColor || "#2C1810",
                  noseStyle: avatarConfig.noseStyle || "normal",
                  suitColor: avatarConfig.suitColor || "#2C3E50",
                  tieColor: avatarConfig.tieColor || "#E74C3C"
                };
                avatars[key] = updatedConfig;
              } catch (error) {
                console.error("Errore nel parsing dell'avatar del candidato:", error);
              }
            }
          } else {
            names[key] = email;
          }
        } catch (error) {
          console.error(`Errore nel recupero dati per ${email}:`, error);
          names[key] = email;
        }
      }
    }

    setCandidateNames(names);
    setCandidateAvatars(avatars);
  };

  // Funzione per recuperare le selezioni di governo dell'utente
  const fetchGovernoIdeale = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/governo/voti`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const votiGoverno = await response.json();
        setGovernoIdeale(votiGoverno);
      }
    } catch (error) {
      console.error('Errore nel recupero delle selezioni di governo:', error);
    }
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      const uidToFetch = userId || (user && user.uid);
      if (!uidToFetch) return;
      
      try {
        // Carica i dati utente tramite API (che ora usa Firebase)
        const response = await fetch(`/api/users/${encodeURIComponent(uidToFetch)}`);
        
        if (response.ok) {
          const userData = await response.json();
          console.log("Dati utente caricati:", userData);
          setUserInfo(userData as UserInfo);
          
          // Estrai le opinioni dai dati utente (ora sono unificati)
          const opinions = {
            energia_nucleare: userData.energia_nucleare || '',
            sperimentazione_animale: userData.sperimentazione_animale || '',
            legalizzazione_canapa: userData.legalizzazione_canapa || '',
            caccia: userData.caccia || '',
            unione_europea: userData.unione_europea || ''
          };
          setUserOpinions(opinions);
          
          // Carica la configurazione avatar se presente
          if (userData.avatar_config) {
            try {
              const config = JSON.parse(userData.avatar_config);
              // Converti le configurazioni legacy
              const updatedConfig = {
                skinColor: config.skinColor || "#FDBCB4",
                hairColor: config.hairColor || "#8B4513",
                hairStyle: config.hairStyle || "short",
                mustacheStyle: config.mustacheStyle || (config.mustache ? "classic" : "none"),
                mustacheColor: config.mustacheColor || "#2C1810",
                beardStyle: config.beardStyle || "none",
                beardColor: config.beardColor || "#2C1810",
                noseStyle: config.noseStyle || "normal",
                suitColor: config.suitColor || "#2C3E50",
                tieColor: config.tieColor || "#E74C3C"
              };
              setAvatarConfig(updatedConfig);
            } catch (error) {
              console.error("Errore nel parsing della configurazione avatar:", error);
            }
          }
          
          // Fetch representative names and candidate names
          await fetchRepresentativeNames(userData);
          await fetchCandidateNames(userData);
          
          // Fetch government selections
          await fetchGovernoIdeale();
        } else {
          // Se l'utente non viene trovato, mostra errore
          setError("Utente non trovato o non esistente.");
          setUserInfo(null);
          return;
        }
      } catch (error) {
        console.error("Errore:", error);
        setError("Errore nel caricamento dei dati del profilo");
      } finally {
        setIsLoadingInfo(false);
      }
    };

    if (user || userId) {
      fetchUserInfo();
    }
  }, [user, userId]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoading || isLoadingInfo ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center text-red-500 text-lg font-semibold">
            {error}
          </div>
        </div>
      ) : userInfo && userInfo.status === 'pending' ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-yellow-300">
            <Loader2 className="h-10 w-10 animate-spin text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-yellow-700">Profilo in fase di approvazione</h2>
            <p className="text-gray-700 mb-2">Il tuo profilo è in fase di approvazione da parte di un amministratore.</p>
            <p className="text-gray-500 text-sm">Riceverai una notifica appena il tuo account sarà attivo. Attendi la conferma prima di poter accedere alle funzionalità della piattaforma.</p>
          </div>
        </div>
      ) : (
        <div className="container mx-auto max-w-4xl">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center"
            onClick={() => {
              if (fromGestisciUtenti) {
                window.location.href = "/gestisci-utenti";
              } else if (userId) {
                window.location.href = "/gestisci-grazia";
              } else {
                window.location.href = "/menu";
              }
            }}
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
              {error ? (
                <div className="text-center text-red-500 p-4">
                  {error}
                </div>
              ) : userInfo && user ? (
                isEditing ? (
                  <EditProfileForm 
                    userData={{...userInfo, uid: user.uid}} 
                    onProfileUpdated={(updatedData) => {
                      // Mostra un toast di conferma
                      toast({
                        title: "Profilo aggiornato",
                        description: "Il profilo è stato aggiornato con successo",
                        variant: "default",
                      });
                      
                      // Reindirizza al menu invece di aggiornare lo stato locale
                      window.location.href = "/menu";
                    }}
                    onCancel={() => setIsEditing(false)}
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Sezione Avatar (solo per utenti autorizzati) */}
                    {(userInfo.ruolo === 'Politico' || userInfo.ruolo === 'Candidato' || userInfo.ruolo === 'Candidato Politico') && (
                      <div className="flex justify-center">
                        <div className="text-center">
                          <h3 className="text-lg font-medium mb-4">Il Tuo Avatar</h3>
                          <CustomAvatar 
                            config={avatarConfig} 
                            size={120}
                            className="mx-auto border-2 border-gray-200 rounded-lg p-2 bg-white shadow-sm"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  </div>
                )
              ) : (
                <div className="text-center p-4">
                  Nessuna informazione trovata per questo utente.
                </div>
              )}
            </CardContent>
            
            <CardFooter className="flex justify-end gap-2">
              {userInfo && user && !isEditing && (
                <>
                  {(userInfo.ruolo === 'Politico' || userInfo.ruolo === 'Candidato' || userInfo.ruolo === 'Candidato Politico') && (
                    <Button 
                      variant="outline"
                      onClick={() => window.location.href = "/modifica-immagine"}
                    >
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

          {/* Sezione Opinioni */}
          {userInfo && userOpinions && (
            <Card className="animate-in-delay">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Le Tue Opinioni Politiche
                </CardTitle>
                <CardDescription>
                  Visualizzazione delle tue posizioni sui temi principali
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Colonna Favorevoli - Verde */}
                  <div className="space-y-3">
                    <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Favorevole
                      </h3>
                      <div className="space-y-2">
                        {categorizeOpinions(userOpinions).favorevoli.length > 0 ? (
                          categorizeOpinions(userOpinions).favorevoli.map((opinion, index) => (
                            <div key={index} className="bg-green-50 border border-green-200 rounded-md p-3">
                              <span className="text-green-800 font-medium">{opinion}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-green-600 text-sm italic">
                            Nessuna opinione favorevole
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Colonna Indecisi - Giallo */}
                  <div className="space-y-3">
                    <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        Indeciso
                      </h3>
                      <div className="space-y-2">
                        {categorizeOpinions(userOpinions).indecisi.length > 0 ? (
                          categorizeOpinions(userOpinions).indecisi.map((opinion, index) => (
                            <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                              <span className="text-yellow-800 font-medium">{opinion}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-yellow-600 text-sm italic">
                            Nessuna opinione indecisa
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Colonna Contrari - Rosso */}
                  <div className="space-y-3">
                    <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                      <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        Contrario
                      </h3>
                      <div className="space-y-2">
                        {categorizeOpinions(userOpinions).contrari.length > 0 ? (
                          categorizeOpinions(userOpinions).contrari.map((opinion, index) => (
                            <div key={index} className="bg-red-50 border border-red-200 rounded-md p-3">
                              <span className="text-red-800 font-medium">{opinion}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-red-600 text-sm italic">
                            Nessuna opinione contraria
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sezione Governo Ideale */}
          {userInfo && Object.keys(governoIdeale).length > 0 && (
            <Card className="animate-in-delay">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Il Tuo Governo Ideale
                </CardTitle>
                <CardDescription>
                  I ministri che hai selezionato per il tuo governo ideale
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(governoIdeale).map(([categoria, nome]) => (
                    <div key={categoria} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 mb-2 capitalize">
                        {categoria.replace('_', ' ')}
                      </h3>
                      <div className="bg-white border border-blue-200 rounded-md p-3">
                        <span className="text-blue-900 font-medium">{nome}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sezione Rappresentanti */}
          {userInfo && (
            <Card className="animate-in-delay">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  I Tuoi Rappresentanti
                </CardTitle>
                <CardDescription>
                  I rappresentanti che hai scelto per i diversi livelli di governo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Rappresentante Europeo */}
                  <div className="space-y-3">
                    <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        Parlamento Europeo
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {representativeAvatars.rappresentante_europeo && (
                            <CustomAvatar 
                              config={representativeAvatars.rappresentante_europeo} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-blue-800 font-medium">
                            {representativeNames.rappresentante_europeo || (userInfo as any).rappresentante_europeo || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rappresentante Camera */}
                  <div className="space-y-3">
                    <div className="bg-purple-100 border border-purple-200 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        Camera dei Deputati
                      </h3>
                      <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {representativeAvatars.rappresentante_camera && (
                            <CustomAvatar 
                              config={representativeAvatars.rappresentante_camera} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-purple-800 font-medium">
                            {representativeNames.rappresentante_camera || (userInfo as any).rappresentante_camera || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rappresentante Senato */}
                  <div className="space-y-3">
                    <div className="bg-indigo-100 border border-indigo-200 rounded-lg p-4">
                      <h3 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                        Senato
                      </h3>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {representativeAvatars.rappresentante_senato && (
                            <CustomAvatar 
                              config={representativeAvatars.rappresentante_senato} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-indigo-800 font-medium">
                            {representativeNames.rappresentante_senato || (userInfo as any).rappresentante_senato || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rappresentante Regionale */}
                  <div className="space-y-3">
                    <div className="bg-orange-100 border border-orange-200 rounded-lg p-4">
                      <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        Consiglio Regionale
                      </h3>
                      <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {representativeAvatars.rappresentante_regionale && (
                            <CustomAvatar 
                              config={representativeAvatars.rappresentante_regionale} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-orange-800 font-medium">
                            {representativeNames.rappresentante_regionale || (userInfo as any).rappresentante_regionale || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rappresentante Comunale */}
                  <div className="space-y-3">
                    <div className="bg-teal-100 border border-teal-200 rounded-lg p-4">
                      <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                        Consiglio Comunale
                      </h3>
                      <div className="bg-teal-50 border border-teal-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {representativeAvatars.rappresentante_comunale && (
                            <CustomAvatar 
                              config={representativeAvatars.rappresentante_comunale} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-teal-800 font-medium">
                            {representativeNames.rappresentante_comunale || (userInfo as any).rappresentante_comunale || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sezione Candidati */}
          {userInfo && (
            <Card className="animate-in-delay">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  I Tuoi Candidati
                </CardTitle>
                <CardDescription>
                  I candidati che hai scelto per i diversi livelli di governo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Candidato Europeo */}
                  <div className="space-y-3">
                    <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        Parlamento Europeo
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {candidateAvatars.candidato_europeo && (
                            <CustomAvatar 
                              config={candidateAvatars.candidato_europeo} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-blue-800 font-medium">
                            {candidateNames.candidato_europeo || (userInfo as any).candidato_europeo || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidato Camera */}
                  <div className="space-y-3">
                    <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Camera dei Deputati
                      </h3>
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {candidateAvatars.candidato_camera && (
                            <CustomAvatar 
                              config={candidateAvatars.candidato_camera} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-green-800 font-medium">
                            {candidateNames.candidato_camera || (userInfo as any).candidato_camera || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidato Senato */}
                  <div className="space-y-3">
                    <div className="bg-purple-100 border border-purple-200 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        Senato della Repubblica
                      </h3>
                      <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {candidateAvatars.candidato_senato && (
                            <CustomAvatar 
                              config={candidateAvatars.candidato_senato} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-purple-800 font-medium">
                            {candidateNames.candidato_senato || (userInfo as any).candidato_senato || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidato Regionale */}
                  <div className="space-y-3">
                    <div className="bg-orange-100 border border-orange-200 rounded-lg p-4">
                      <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        Consiglio Regionale
                      </h3>
                      <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {candidateAvatars.candidato_regionale && (
                            <CustomAvatar 
                              config={candidateAvatars.candidato_regionale} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-orange-800 font-medium">
                            {candidateNames.candidato_regionale || (userInfo as any).candidato_regionale || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidato Comunale */}
                  <div className="space-y-3">
                    <div className="bg-teal-100 border border-teal-200 rounded-lg p-4">
                      <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                        Consiglio Comunale
                      </h3>
                      <div className="bg-teal-50 border border-teal-200 rounded-md p-3">
                        <div className="flex items-center gap-3">
                          {candidateAvatars.candidato_comunale && (
                            <CustomAvatar 
                              config={candidateAvatars.candidato_comunale} 
                              size={40} 
                              className="flex-shrink-0"
                            />
                          )}
                          <span className="text-teal-800 font-medium">
                            {candidateNames.candidato_comunale || (userInfo as any).candidato_comunale || "Non selezionato"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}