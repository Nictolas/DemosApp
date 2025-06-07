import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale, Vote, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Classifica {
  nome: string;
  voti: number;
}

export default function Amnistia() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [classifica, setClassifica] = useState<Classifica[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [leggeInput, setLeggeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Carica i dati dell'utente e la classifica
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Carica i voti dell'utente
      const votiResponse = await fetch('/api/amnistia/voti', {
        credentials: 'include'
      });
      if (votiResponse.ok) {
        const voti = await votiResponse.json();
        setUserVoti(voti);
      }

      // Carica la classifica
      const classificaResponse = await fetch('/api/amnistia/classifica');
      if (classificaResponse.ok) {
        const classificaData = await classificaResponse.json();
        setClassifica(classificaData);
      }
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leggeInput.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci una legge valida",
        variant: "destructive",
      });
      return;
    }

    await voteForLaw(leggeInput.trim());
  };

  const voteForLaw = async (legge: string) => {
    // Check if user has already voted for this law
    if (userVoti.includes(legge)) {
      toast({
        title: "Voto già registrato",
        description: `Hai già votato per ${legge}`,
        variant: "destructive",
      });
      return;
    }

    setIsVoting(true);
    try {
      const response = await fetch('/api/amnistia/vota', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ legge }),
      });

      if (response.ok) {
        toast({
          title: "Voto registrato",
          description: `Hai votato ${legge} per l'amnistia`,
        });
        
        setLeggeInput("");
        setShowSuggestions(false);
        await loadData();
      } else {
        const error = await response.json();
        toast({
          title: "Errore",
          description: error.error || "Errore nel registrare il voto",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore nel votare:', error);
      toast({
        title: "Errore",
        description: "Errore di connessione",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const removeVote = async (legge: string) => {
    toast({
      title: "Info",
      description: "Funzione di rimozione voto in sviluppo",
    });
  };

  const deleteFromClassifica = async (legge: string) => {
    if (user?.email !== "polidemos@gmail.com") return;
    
    setIsDeleting(legge);
    toast({
      title: "Info", 
      description: "Funzione di eliminazione in sviluppo",
    });
    setIsDeleting(null);
  };

  const getSuggestions = () => {
    if (!leggeInput.trim() || !showSuggestions) return [];
    
    return classifica
      .filter(item => 
        item.nome.toLowerCase().includes(leggeInput.toLowerCase()) &&
        item.nome.toLowerCase() !== leggeInput.toLowerCase()
      )
      .slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center"
          onClick={() => window.location.href = "/menu"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
        </Button>
        
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-r from-orange-500 to-orange-700 rounded-full">
                <Scale className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent">
              Amnistia
            </CardTitle>
            <CardDescription className="text-lg">
              Vota per le leggi che meritano l'amnistia (puoi votare più leggi)
            </CardDescription>
          </CardHeader>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Form di voto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Vote className="h-5 w-5" />
                  <span>Vota per l'Amnistia</span>
                </CardTitle>
                <CardDescription>
                  Inserisci il nome della legge che meriterebbe l'amnistia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVote} className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Nome della legge..."
                        value={leggeInput}
                        onChange={(e) => {
                          setLeggeInput(e.target.value);
                          setShowSuggestions(true);
                        }}
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
                              onClick={() => {
                                setLeggeInput(suggestion.nome);
                                setShowSuggestions(false);
                              }}
                            >
                              {suggestion.nome} ({suggestion.voti} voti)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isVoting || !leggeInput.trim()}
                    >
                      {isVoting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Vota
                    </Button>
                  </div>
                </form>

                {userVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">I tuoi voti:</h4>
                    <div className="flex flex-wrap gap-2">
                      {userVoti.map((voto, index) => (
                        <Badge 
                          key={index} 
                          variant="default"
                          className="cursor-pointer hover:bg-destructive/90 transition-colors"
                          onClick={() => removeVote(voto)}
                        >
                          <Vote className="h-3 w-3 mr-1" />
                          {voto}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Clicca su un nome per rimuovere il voto
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Classifica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span>Classifica Top 10</span>
                </CardTitle>
                <CardDescription>
                  Le leggi più votate per l'amnistia
                </CardDescription>
              </CardHeader>
              <CardContent>
                {classifica.length > 0 ? (
                  <div className="space-y-3">
                    {classifica.map((legge, index) => (
                      <div key={legge.nome} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => voteForLaw(legge.nome)}
                            disabled={isVoting}
                            className="h-8 w-8 p-0"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            #{index + 1}
                          </div>
                          <span className="font-medium">{legge.nome}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {legge.voti} voti
                          </Badge>
                          {user?.email === "polidemos@gmail.com" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteFromClassifica(legge.nome)}
                              disabled={isDeleting === legge.nome}
                              className="h-8 w-8 p-0"
                            >
                              {isDeleting === legge.nome ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nessun voto ancora registrato. Sii il primo a votare!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}