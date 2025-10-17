import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth-neon';
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Edit, User, Image } from "lucide-react";
import { UserInfo } from "@/types/user";
// Firebase rimosso - migrazione completata a Neon + Auth.js
// import { db, auth } from "@/lib/firebase-stub";
// import { doc, getDoc } from "firebase/firestore";
import { EditProfileForm } from "@/components/EditProfileForm";
import { CustomAvatar } from "@/components/CustomAvatar";
import { useToast } from "@/hooks/use-toast";
// import { doc, getDoc } from "firebase/firestore";

export default function Profilo() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userOpinions, setUserOpinions] = useState<any>(null);
  const [representativeNames, setRepresentativeNames] = useState<Record<string, string>>({});
  const [avatarConfig, setAvatarConfig] = useState<any>(null);

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

  // Funzione per recuperare i nomi dei rappresentanti
  const fetchRepresentativeNames = async (userInfo: any) => {
    const representatives = {
      rappresentante_europeo: userInfo.rappresentante_europeo,
      rappresentante_camera: userInfo.rappresentante_camera,
      rappresentante_senato: userInfo.rappresentante_senato,
      rappresentante_regionale: userInfo.rappresentante_regionale,
      rappresentante_comunale: userInfo.rappresentante_comunale,
    };
    const names: Record<string, string> = {};
    for (const [key, uid] of Object.entries(representatives)) {
      if (uid && typeof uid === 'string') {
        try {
          // const rappresentanteDocRef = doc(db, "utenti", uid);
          // const rappresentanteDoc = await getDoc(rappresentanteDocRef);
          // if (rappresentanteDoc.exists()) {
          //   const userData = rappresentanteDoc.data();
          //   names[key] = `${userData.nome} ${userData.cognome}`;
          // } else {
            names[key] = uid;
          // }
        } catch (error) {
          console.error(`Errore nel recupero dati per ${uid}:`, error);
          names[key] = uid;
        }
      }
    }
    setRepresentativeNames(names);
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user) return;
      
      try {
        // Carica i dati utente tramite API (che ora usa Firebase)
        const response = await fetch(`/api/users/${encodeURIComponent(user.email)}`);
        
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
              setAvatarConfig(config);
            } catch (error) {
              console.error("Errore nel parsing della configurazione avatar:", error);
            }
          }
          
          // Fetch representative names
          await fetchRepresentativeNames(userData);
        } else {
          console.log("Dati non trovati, caricamento dal profilo locale");
          
          // Fallback: carica i dati dal database locale
          const profileResponse = await fetch(`/api/users/${user.id}/profile`);
          if (!profileResponse.ok) {
            throw new Error("Errore nel caricamento dei dati del profilo");
          }
          
          const data = await profileResponse.json();
          setUserInfo(data);
        }
      } catch (error) {
        console.error("Errore:", error);
        setError("Errore nel caricamento dei dati del profilo");
      } finally {
        setIsLoadingInfo(false);
      }
    };

    if (user) {
      fetchUserInfo();
    }
  }, [user]);

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
      ) : (
        <div className="container mx-auto max-w-4xl">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center"
            onClick={() => window.location.href = "/menu"}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Il tuo Profilo
              </CardTitle>
              <CardDescription>
                Visualizza e gestisci le tue informazioni personali
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
                    userData={{...userInfo, email: user.email}} 
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
                    {(userInfo.ruolo === "P" || userInfo.ruolo === "C" || userInfo.ruolo === "CP") && (
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
                          <p><strong>Nome:</strong> {userInfo.name}</p>
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
                  {(userInfo.ruolo === "P" || userInfo.ruolo === "C" || userInfo.ruolo === "CP") && (
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
                        {(userInfo as any).rappresentante_europeo ? (
                          <span className="text-blue-800 font-medium">
                            {representativeNames.rappresentante_europeo || 'Caricamento...'}
                          </span>
                        ) : (
                          <span className="text-blue-600 text-sm italic">Non selezionato</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rappresentante Camera */}
                  <div className="space-y-3">
                    <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Camera dei Deputati
                      </h3>
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        {(userInfo as any).rappresentante_camera ? (
                          <span className="text-green-800 font-medium">
                            {representativeNames.rappresentante_camera || 'Caricamento...'}
                          </span>
                        ) : (
                          <span className="text-green-600 text-sm italic">Non selezionato</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rappresentante Senato */}
                  <div className="space-y-3">
                    <div className="bg-purple-100 border border-purple-200 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        Senato della Repubblica
                      </h3>
                      <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                        {(userInfo as any).rappresentante_senato ? (
                          <span className="text-purple-800 font-medium">
                            {representativeNames.rappresentante_senato || 'Caricamento...'}
                          </span>
                        ) : (
                          <span className="text-purple-600 text-sm italic">Non selezionato</span>
                        )}
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
                        {(userInfo as any).rappresentante_regionale ? (
                          <span className="text-orange-800 font-medium">
                            {representativeNames.rappresentante_regionale || 'Caricamento...'}
                          </span>
                        ) : (
                          <span className="text-orange-600 text-sm italic">Non selezionato</span>
                        )}
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
                        {(userInfo as any).rappresentante_comunale ? (
                          <span className="text-teal-800 font-medium">
                            {representativeNames.rappresentante_comunale || 'Caricamento...'}
                          </span>
                        ) : (
                          <span className="text-teal-600 text-sm italic">Non selezionato</span>
                        )}
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
