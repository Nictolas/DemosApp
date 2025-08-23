import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
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
  sitoWeb?: string;
  quorum: string;
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
  const { data, isLoading: isLoadingData } = useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati.");
      return response.json();
    },
    enabled: !!user
  });

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setSelectedVoti(data.mieiVoti);
    }
  }, [data]);

  // 2. Mutazione per aggiungere voto
  const addVoteMutation = useMutation({
    mutationFn: (referendumId: string) => apiRequest("POST", "/api/referendum-abrogativi/vota", { referendumId }),
    onSuccess: () => {
      toast({ title: "Voto registrato", description: "Il tuo voto è stato registrato con successo." });
      queryClient.invalidateQueries({ queryKey: ['referendumAbrogativiData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile registrare il voto.", variant: "destructive" });
    }
  });

  // 3. Mutazione per rimuovere voto
  const removeVoteMutation = useMutation({
    mutationFn: (referendumId: string) => apiRequest("DELETE", "/api/referendum-abrogativi/vota", { referendumId }),
    onSuccess: () => {
      toast({ title: "Voto rimosso", description: "Hai rimosso il tuo voto." });
      queryClient.invalidateQueries({ queryKey: ['referendumAbrogativiData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile rimuovere il voto.", variant: "destructive" });
    }
  });

  // Logica locale per gestire i voti
  const handleVote = (referendumId: string) => {
    if (selectedVoti.includes(referendumId)) {
      removeVoteMutation.mutate(referendumId);
    } else {
      addVoteMutation.mutate(referendumId);
    }
  };

  // Logica per espandere la classifica
  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/vota">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Vota
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-red-500 to-red-700 rounded-full"><Trophy className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Referendum Abrogativi</CardTitle>
            <CardDescription className="text-lg">Vota i referendum abrogativi che hanno raggiunto il quorum</CardDescription>
          </CardHeader>
        </Card>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* Tabella dei referendum */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><ThumbsUp className="h-5 w-5" /><span>Referendum Disponibili</span></CardTitle>
                <CardDescription>Seleziona i referendum per cui vuoi votare</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.referendum && data.referendum.length > 0 ? (
                  <div className="space-y-3">
                    {data.referendum.map((ref) => {
                      const haVotato = selectedVoti.includes(ref.id);
                      return (
                        <div key={ref.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all duration-300">
                          <div className="flex-1">
                            {ref.sitoWeb ? (
                              <a
                                href={ref.sitoWeb}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 underline hover:text-blue-900 cursor-pointer font-medium"
                              >
                                {ref.nome}
                              </a>
                            ) : (
                              <span className="font-medium">{ref.nome}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600">
                              {data.classifica.find(c => c.nome === ref.nome)?.voti || 0} voti
                            </span>
                            <Button
                              variant={haVotato ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleVote(ref.id)}
                              disabled={addVoteMutation.isPending || removeVoteMutation.isPending}
                              className={haVotato ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                              {haVotato ? (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  Rimuovi
                                </>
                              ) : (
                                <>
                                  <ThumbsUp className="h-4 w-4 mr-2" />
                                  Vota
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
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Trophy className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-600">Nessun referendum disponibile al momento</p>
                    <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Classifica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Referendum</span></CardTitle>
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
                          className="group flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-yellow-500 group-hover:to-yellow-700 transition-all duration-300">
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
                            onClick={() => {
                              const referendum = data.referendum.find(r => r.nome === item.nome);
                              if (referendum) handleVote(referendum.id);
                            }}
                            disabled={addVoteMutation.isPending || removeVoteMutation.isPending}
                            className="hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700 transition-all duration-300"
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            {data.referendum.find(r => r.nome === item.nome) && selectedVoti.includes(data.referendum.find(r => r.nome === item.nome)!.id) ? "Selezionato" : "Seleziona"}
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
                            className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-300 transform hover:scale-[1.02] shadow-md"
                          >
                            <Trophy className="h-5 w-5 mr-2 text-blue-600" />
                            {showAllClassifica 
                              ? `Nascondi (${data.classifica.length - 3} referendum)` 
                              : `Mostra Altro (${data.classifica.length - 3} referendum rimanenti)`
                            }
                          </Button>
                        </div>
                        
                        {/* Referendum rimanenti (animati) */}
                        {showAllClassifica && (
                          <div className="space-y-3 transition-all duration-500 ease-out">
                            {data.classifica.slice(3).map((item, index) => (
                              <div 
                                key={item.nome} 
                                className="group flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                              >
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-blue-500 group-hover:to-indigo-700 transition-all duration-300">
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
                                  onClick={() => {
                                    const referendum = data.referendum.find(r => r.nome === item.nome);
                                    if (referendum) handleVote(referendum.id);
                                  }}
                                  disabled={addVoteMutation.isPending || removeVoteMutation.isPending}
                                  className="hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all duration-300"
                                >
                                  <ThumbsUp className="h-4 w-4 mr-2" />
                                  {data.referendum.find(r => r.nome === item.nome) && selectedVoti.includes(data.referendum.find(r => r.nome === item.nome)!.id) ? "Selezionato" : "Seleziona"}
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
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Trophy className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-600">Nessuna classifica disponibile al momento</p>
                    <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 