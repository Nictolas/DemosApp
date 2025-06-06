import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Crown, Vote, Trophy, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Classifica {
  nome: string;
  voti: number;
}

export default function CapodiStato() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [classifica, setClassifica] = useState<Classifica[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [nomeInput, setNomeInput] = useState("");

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
      const votiResponse = await fetch('/api/capo-stato/voti', {
        credentials: 'include'
      });
      if (votiResponse.ok) {
        const voti = await votiResponse.json();
        setUserVoti(voti);
      }

      // Carica la classifica
      const classificaResponse = await fetch('/api/capo-stato/classifica');
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
    
    if (!nomeInput.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome valido",
        variant: "destructive",
      });
      return;
    }

    setIsVoting(true);
    try {
      const response = await fetch('/api/capo-stato/vota', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nome: nomeInput.trim()
        }),
      });

      if (response.ok) {
        toast({
          title: "Voto registrato",
          description: `Hai votato ${nomeInput} per Capo di Stato`,
        });
        
        setNomeInput("");
        // Aggiorna i dati
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
              <div className="p-4 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full">
                <Crown className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
              Capo di Stato
            </CardTitle>
            <CardDescription className="text-lg">
              Vota per il tuo candidato preferito per Capo di Stato (puoi votare più persone)
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
                  <span>Vota per Capo di Stato</span>
                </CardTitle>
                <CardDescription>
                  Inserisci il nome del cittadino che vorresti come Capo di Stato
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVote} className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Nome del candidato..."
                      value={nomeInput}
                      onChange={(e) => setNomeInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      disabled={isVoting || !nomeInput.trim()}
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
                        <Badge key={index} variant="default">
                          <Vote className="h-3 w-3 mr-1" />
                          {voto}
                        </Badge>
                      ))}
                    </div>
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
                  I candidati più votati per Capo di Stato
                </CardDescription>
              </CardHeader>
              <CardContent>
                {classifica.length > 0 ? (
                  <div className="space-y-3">
                    {classifica.map((candidato, index) => (
                      <div key={candidato.nome} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            #{index + 1}
                          </div>
                          <span className="font-medium">{candidato.nome}</span>
                        </div>
                        <Badge variant="outline">
                          {candidato.voti} voti
                        </Badge>
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