import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Classifica { nome: string; voti: number; }

export default function Grazia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [classifica, setClassifica] = useState<Classifica[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [nomeInput, setNomeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deletingVote, setDeletingVote] = useState<string | null>(null);
  const [deletingClassifica, setDeletingClassifica] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [votiResponse, classificaResponse] = await Promise.all([
        apiRequest("GET", "/api/grazia/voti"),
        apiRequest("GET", "/api/grazia/classifica")
      ]);
      if (votiResponse.ok) setUserVoti(Array.isArray(votiResponse.data) ? votiResponse.data : []);
      if (classificaResponse.ok) setClassifica(Array.isArray(classificaResponse.data) ? classificaResponse.data : []);
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeInput.trim()) return;
    await voteForCandidate(nomeInput.trim());
  };

  const voteForCandidate = async (nome: string) => {
    if (userVoti.includes(nome)) {
      toast({ title: "Voto già registrato", description: `Hai già votato per ${nome}` });
      return;
    }
    setIsVoting(true);
    try {
      const response = await apiRequest("POST", "/api/grazia/vota", { nome });
      if (response.ok) {
        toast({ title: "Voto registrato", description: `Hai votato ${nome}` });
        setNomeInput("");
        await loadData();
      } else {
        const error = response.data;
        toast({ title: "Errore", description: error.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const removeVote = async (nomeDaRimuovere: string) => {
    if (deletingVote) return;
    if (!window.confirm(`Sei sicuro di voler rimuovere il voto per "${nomeDaRimuovere}"?`)) return;

    setDeletingVote(nomeDaRimuovere);
    try {
      const response = await apiRequest("DELETE", `/api/grazia/voti/${encodeURIComponent(nomeDaRimuovere)}`);

      if (response.ok) {
        toast({ title: "Voto rimosso", description: `Hai rimosso il voto per ${nomeDaRimuovere}`});
        setUserVoti(currentVotes => currentVotes.filter(voto => voto !== nomeDaRimuovere));
        loadData();
      } else {
        const error = response.data;
        toast({ title: "Errore", description: error.error || "Errore nella rimozione", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setDeletingVote(null);
    }
  };

  const getSuggestions = () => {
    if (!nomeInput.trim() || !showSuggestions) return [];
    return classifica
      .filter(item => item.nome.toLowerCase().includes(nomeInput.toLowerCase()) && item.nome.toLowerCase() !== nomeInput.toLowerCase())
      .slice(0, 5);
  };

  // Funzione per eliminare un carcerato dalla classifica (solo admin)
  const deleteFromClassifica = async (nome: string) => {
    if (user?.ruolo !== "Admin") return;
    if (!window.confirm(`Sei sicuro di voler eliminare definitivamente ${nome} dalla classifica?`)) return;
    setDeletingClassifica(nome);
    try {
      const response = await apiRequest("DELETE", `/api/grazia/classifica/${encodeURIComponent(nome)}`);
      if (response.ok) {
        toast({ title: "Candidato eliminato", description: `${nome} è stato rimosso dalla classifica.` });
        await loadData();
      } else {
        const error = response.data;
        toast({ title: "Errore", description: error.error || "Errore nell'eliminazione", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setDeletingClassifica(null);
    }
  };

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full"><Scale className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">Grazia</CardTitle>
            <CardDescription className="text-lg">Vota per chiedere la grazia a favore di un carcerato. Puoi esprimere più preferenze.</CardDescription>
          </CardHeader>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Scale className="h-5 w-5" /><span>La tua richiesta di grazia</span></CardTitle>
                <CardDescription>Inserisci il nome del carcerato per cui vuoi chiedere la grazia.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVote} className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Nome del carcerato..."
                        value={nomeInput}
                        onChange={(e) => { setNomeInput(e.target.value); setShowSuggestions(true); }}
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
                              onClick={() => { setNomeInput(suggestion.nome); setShowSuggestions(false); }}
                            >
                              {suggestion.nome} ({suggestion.voti} voti)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button type="submit" disabled={isVoting || !nomeInput.trim()}>
                      {isVoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Chiedi Grazia
                    </Button>
                  </div>
                </form>

                {userVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Le tue richieste di grazia:</h4>
                    <div className="flex flex-wrap gap-2">
                      {userVoti.map((voto, index) => (
                        <Badge 
                          key={index} 
                          variant="default"
                          className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2"
                          onClick={() => removeVote(voto)}
                        >
                          {deletingVote === voto ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
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
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Top 10</span></CardTitle>
                <CardDescription>I carcerati che hanno ricevuto più richieste di grazia</CardDescription>
              </CardHeader>
              <CardContent>
                {classifica.length > 0 ? (
                  <div className="space-y-3">
                    {classifica.map((carcerato, index) => (
                      <div key={carcerato.nome} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Button size="sm" variant="outline" onClick={() => voteForCandidate(carcerato.nome)} disabled={isVoting} className="h-8 w-8 p-0"><ThumbsUp className="h-3 w-3" /></Button>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>#{index + 1}</div>
                          <span className="font-medium">{carcerato.nome}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{carcerato.voti} richieste</Badge>
                          {user?.ruolo === "Admin" && (
                            <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => deleteFromClassifica(carcerato.nome)} disabled={deletingClassifica === carcerato.nome}>
                              {deletingClassifica === carcerato.nome ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nessuna richiesta ancora registrata.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}