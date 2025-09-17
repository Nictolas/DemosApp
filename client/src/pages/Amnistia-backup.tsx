import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Classifica { legge: string; voti: number; }
interface AmnistiaData {
  classifica: Classifica[];
  mieiVoti: string[];
}

export default function Amnistia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [leggeInput, setLeggeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAllClassifica, setShowAllClassifica] = useState(false);

  // 1. Caricamento dati con React Query
  const { data, isLoading: isLoadingData } = useQuery<AmnistiaData>({
    queryKey: ['amnistiaData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/amnistia");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati.");
      return response.json();
    },
    enabled: !!user
  });

  // 2. Mutazione per aggiungere voto
  const addVoteMutation = useMutation({
    mutationFn: (legge: string) => apiRequest("POST", "/api/amnistia/vota", { legge }),
    onSuccess: () => {
      toast({ title: "Voto registrato", description: "Il tuo voto è stato registrato con successo." });
      queryClient.invalidateQueries({ queryKey: ['amnistiaData'] });
      setLeggeInput("");
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile registrare il voto.", variant: "destructive" });
    }
  });

  // 3. Mutazione per rimuovere voto
  const removeVoteMutation = useMutation({
    mutationFn: (legge: string) => apiRequest("DELETE", "/api/amnistia/vota", { legge }),
    onSuccess: () => {
      toast({ title: "Voto rimosso", description: "Il tuo voto è stato rimosso con successo." });
      queryClient.invalidateQueries({ queryKey: ['amnistiaData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile rimuovere il voto.", variant: "destructive" });
    }
  });

  // Logica locale per gestire i voti
  const handleAddVote = (e: React.FormEvent) => {
    e.preventDefault();
    const leggePulita = leggeInput.trim();
    if (!leggePulita) return;
    if (data?.mieiVoti.includes(leggePulita)) {
      toast({ title: "Voto già registrato", description: `Hai già votato per l'amnistia di: ${leggePulita}` });
      return;
    }
    addVoteMutation.mutate(leggePulita);
  };

  const handleRemoveVote = (legge: string) => {
    if (!window.confirm(`Sei sicuro di voler rimuovere il voto per l'amnistia di "${legge}"?`)) return;
    removeVoteMutation.mutate(legge);
  };

  const getSuggestions = () => {
    if (!leggeInput.trim() || !showSuggestions) return [];
    return (data?.classifica || [])
      .filter(item => item.legge.toLowerCase().includes(leggeInput.toLowerCase()) && item.legge.toLowerCase() !== leggeInput.toLowerCase())
      .slice(0, 5);
  };

  // Logica per espandere la classifica
  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  // Il resto del codice JSX per la visualizzazione rimane IDENTICO
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full"><FileText className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Amnistia</CardTitle>
            <CardDescription className="text-lg">Vota per l'amnistia di una legge. Puoi esprimere più preferenze.</CardDescription>
          </CardHeader>
        </Card>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><FileText className="h-5 w-5" /><span>La tua richiesta di amnistia</span></CardTitle>
                <CardDescription>Inserisci la legge per cui vuoi chiedere l'amnistia.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddVote} className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Nome della legge..."
                        value={leggeInput}
                        onChange={(e) => { setLeggeInput(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        className="w-full"
                      />
                      {showSuggestions && getSuggestions().length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                          {getSuggestions().map((suggestion, index) => (
                            <button
                              key={index}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 border-b border-gray-100 last:border-b-0"
                              onClick={() => { setLeggeInput(suggestion.legge); setShowSuggestions(false); }}
                            >
                              {suggestion.legge} ({suggestion.voti} voti)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button type="submit" disabled={addVoteMutation.isPending || !leggeInput.trim()}>
                      {addVoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Vota Amnistia
                    </Button>
                  </div>
                </form>

                {data?.mieiVoti && data.mieiVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Le tue richieste di amnistia:</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.mieiVoti.map((voto, index) => (
                        <Badge 
                          key={index} 
                          variant="default"
                          className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2"
                          onClick={() => handleRemoveVote(voto)}
                        >
                          {removeVoteMutation.isPending && removeVoteMutation.variables === voto ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          {voto}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Clicca su un nome per rimuovere la richiesta.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Leggi</span></CardTitle>
                <CardDescription>Le leggi che hanno ricevuto più richieste di amnistia ({data?.classifica?.length || 0} totali)</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.classifica && data.classifica.length > 0 ? (
                  <div className="space-y-4">
                    {/* Primi 3 leggi sempre visibili */}
                    <div className="space-y-3">
                      {data.classifica.slice(0, 3).map((item, index) => (
                        <div 
                          key={item.legge} 
                          className="group flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-yellow-500 group-hover:to-yellow-700 transition-all duration-300">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800 text-lg group-hover:text-yellow-800 transition-colors duration-300">{item.legge}</h4>
                              <p className="text-sm text-gray-600 flex items-center">
                                <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
                                {item.voti} voti
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLeggeInput(item.legge)}
                            disabled={addVoteMutation.isPending}
                            className="hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700 transition-all duration-300"
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            Vota
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Leggi rimanenti (espandibili) */}
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
                              ? `Nascondi (${data.classifica.length - 3} leggi)` 
                              : `Mostra Altro (${data.classifica.length - 3} leggi rimanenti)`
                            }
                          </Button>
                        </div>
                        
                        {/* Leggi rimanenti (animati) */}
                        {showAllClassifica && (
                          <div className="space-y-3 transition-all duration-500 ease-out">
                            {data.classifica.slice(3).map((item, index) => (
                              <div 
                                key={item.legge} 
                                className="group flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                              >
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-blue-500 group-hover:to-indigo-700 transition-all duration-300">
                                    {index + 4}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-800 text-lg group-hover:text-indigo-800 transition-colors duration-300">{item.legge}</h4>
                                    <p className="text-sm text-gray-600 flex items-center">
                                      <Trophy className="h-4 w-4 mr-2 text-blue-500" />
                                      {item.voti} voti
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLeggeInput(item.legge)}
                                  disabled={addVoteMutation.isPending}
                                  className="hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all duration-300"
                                >
                                  <ThumbsUp className="h-4 w-4 mr-2" />
                                  Vota
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
