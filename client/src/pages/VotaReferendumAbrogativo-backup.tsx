import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ThumbsUp, X, Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Referendum {
  id: string;
  nome: string;
  data_inizio?: string;
  data_fine?: string;
  status?: string;
  quorum?: string;
  firestore_id_backup?: string;
}

interface Classifica {
  nome: string;
  voti: number;
}

interface ReferendumAbrogativiData {
  referendum: Referendum[];
  classifica: Classifica[];
  mieiVoti: string[];
}

export default function VotaReferendumAbrogativo() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showAllClassifica, setShowAllClassifica] = useState(false);

  // 1. Caricamento dati con React Query
  const { data, isLoading: isLoadingData, error } = useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/referendum-abrogativi avviata');
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      console.log('🔍 DEBUG: Risposta ricevuta:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API /referendum-abrogativi:', errorData);
        throw new Error(`Errore ${response.status}: ${errorData}`);
      }
      const result = await response.json();
      console.log('✅ Dati referendum abrogativi ricevuti:', result);
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setSelectedVoti(data.mieiVoti);
    }
  }, [data]);

  // 2. Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/referendum-abrogativi/vota", { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "Le tue preferenze per i referendum abrogativi sono state aggiornate." });
      queryClient.invalidateQueries({ queryKey: ['referendumAbrogativiData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le preferenze.", variant: "destructive" });
    }
  });

  // Logica locale per gestire i voti
  const toggleSelezione = (referendumId: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev => 
      prev.includes(referendumId) 
        ? prev.filter(id => id !== referendumId)
        : [...prev, referendumId]
    );
  };

  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    const referendum = data?.referendum.find(r => r.nome === nome);
    if (referendum) {
      toggleSelezione(referendum.id);
    }
  };

  // Logica per espandere la classifica
  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/vota">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Vota
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-linear-to-r from-red-500 to-red-700 rounded-full"><Trophy className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-linear-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Referendum Abrogativi</CardTitle>
            <CardDescription className="text-lg">Seleziona i referendum abrogativi che preferisci</CardDescription>
          </CardHeader>
        </Card>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-sm">
            <b>Errore nel caricamento dei dati:</b><br />
            {error.message}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Le tue preferenze */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><ThumbsUp className="h-5 w-5" /><span>Le tue preferenze per i referendum abrogativi</span></CardTitle>
                <CardDescription>Seleziona i referendum che preferisci.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">I tuoi referendum selezionati:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVoti.map((id) => {
                        const referendum = data?.referendum.find(r => r.id === id);
                        return referendum ? (
                          <span key={id} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            <X className="h-3 w-3 mr-1 cursor-pointer" onClick={() => toggleSelezione(id)} />
                            {referendum.nome}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabella dei referendum */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><ThumbsUp className="h-5 w-5" /><span>Referendum Disponibili</span></CardTitle>
                <CardDescription>Seleziona i referendum che preferisci</CardDescription>
              </CardHeader>
              <CardContent>
                                    {data?.referendum && data.referendum.length > 0 ? (
                      <div className="space-y-3">
                        {data.referendum.map((ref) => {
                          const haVotato = selectedVoti.includes(ref.id);
                          return (
                            <div key={ref.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all duration-300">
                              <div className="flex-1">
                                <span className="font-medium">{ref.nome}</span>
                                {ref.data_inizio && ref.data_fine && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    {new Date(ref.data_inizio).toLocaleDateString('it-IT')} - {new Date(ref.data_fine).toLocaleDateString('it-IT')}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-600">
                                  {data.classifica.find(c => c.nome === ref.nome)?.voti || 0} voti
                                </span>
                                <Button
                                  variant={haVotato ? "default" : "outline-solid"}
                                  size="sm"
                                  onClick={() => toggleSelezione(ref.id)}
                                  disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                                  className={haVotato ? "bg-green-600 hover:bg-green-700" : ""}
                                >
                                  {haVotato ? (
                                    <>
                                      <X className="h-4 w-4 mr-2" />
                                      Selezionato
                                    </>
                                  ) : (
                                    <>
                                      <ThumbsUp className="h-4 w-4 mr-2" />
                                      Seleziona
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-20 h-20 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Trophy className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-600">Nessun referendum abrogativo disponibile al momento</p>
                    <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Classifica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Referendum Abrogativi</span></CardTitle>
                <CardDescription>I referendum che hanno ricevuto più voti ({data?.classifica?.length || 0} totali)</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.classifica && data.classifica.length > 0 ? (
                  <div className="space-y-4">
                    {/* Primi 3 referendum sempre visibili */}
                    <div className="space-y-3">
                      {data.classifica.slice(0, 3).map((item, index) => (
                        <div 
                          key={item.nome} 
                          className="group flex items-center justify-between p-4 bg-linear-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-linear-to-br from-yellow-400 to-yellow-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-yellow-500 group-hover:to-yellow-700 transition-all duration-300">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800 text-lg group-hover:text-yellow-800 transition-colors duration-300">{item.nome}</h4>
                              <p className="text-sm text-gray-600 flex items-center">
                                <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
                                {item.voti} voti
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleSelezioneClassifica(item.nome)}
                            disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                            className={`transition-all duration-300 ${
                              data.referendum.find(r => r.nome === item.nome) && selectedVoti.includes(data.referendum.find(r => r.nome === item.nome)!.id)
                                ? "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200 shadow-md"
                                : "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                            }`}
                          >
                            {data.referendum.find(r => r.nome === item.nome) && selectedVoti.includes(data.referendum.find(r => r.nome === item.nome)!.id) ? (
                              <>
                                <ThumbsUp className="h-4 w-4 mr-2" />
                                Selezionato
                              </>
                            ) : (
                              <>
                                <ThumbsUp className="h-4 w-4 mr-2" />
                                Seleziona
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Referendum rimanenti (espandibili) */}
                    {data.classifica.length > 3 && (
                      <div className="space-y-3">
                        {/* Pulsante per espandere/comprimere */}
                        <div className="text-center">
                          <Button 
                            onClick={handleShowClassifica} 
                            variant="outline" 
                            size="lg"
                            className="w-full bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-300 transform hover:scale-[1.02] shadow-md"
                          >
                            <Trophy className="h-5 w-5 mr-2 text-blue-600" />
                            {showAllClassifica 
                              ? `Nascondi (${data.classifica.length - 3} referendum abrogativi)` 
                              : `Mostra Altro (${data.classifica.length - 3} referendum abrogativi rimanenti)`
                            }
                          </Button>
                        </div>
                        
                        {/* Referendum rimanenti (animati) */}
                        {showAllClassifica && (
                          <div className="space-y-3 transition-all duration-500 ease-out">
                            {data.classifica.slice(3).map((item, index) => (
                              <div 
                                key={item.nome} 
                                className="group flex items-center justify-between p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                              >
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center justify-center w-10 h-10 bg-linear-to-br from-blue-400 to-indigo-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-blue-500 group-hover:to-indigo-700 transition-all duration-300">
                                    {index + 4}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-800 text-lg group-hover:text-indigo-800 transition-colors duration-300">{item.nome}</h4>
                                    <p className="text-sm text-gray-600 flex items-center">
                                      <Trophy className="h-4 w-4 mr-2 text-blue-500" />
                                      {item.voti} voti
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleSelezioneClassifica(item.nome)}
                                  disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                                  className={`transition-all duration-300 ${
                                    data.referendum.find(r => r.nome === item.nome) && selectedVoti.includes(data.referendum.find(r => r.nome === item.nome)!.id)
                                      ? "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200 shadow-md"
                                      : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                                  }`}
                                >
                                  {data.referendum.find(r => r.nome === item.nome) && selectedVoti.includes(data.referendum.find(r => r.nome === item.nome)!.id) ? (
                                    <>
                                      <ThumbsUp className="h-4 w-4 mr-2" />
                                      Selezionato
                                    </>
                                  ) : (
                                    <>
                                      <ThumbsUp className="h-4 w-4 mr-2" />
                                      Seleziona
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-20 h-20 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Trophy className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-600">Nessuna classifica referendum disponibile al momento</p>
                    <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end mt-4">
              <Button onClick={() => saveVotiMutation.mutate(selectedVoti)} disabled={saveVotiMutation.isPending || !votiCambiati || data?.blocco.isBlocked}>
                {saveVotiMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salva le mie Preferenze
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
