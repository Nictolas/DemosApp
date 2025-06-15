import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, Redirect } from "wouter"; // Usa <Link> per la navigazione interna
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Crown, Vote, Trophy, Plus, X, ThumbsUp } from "lucide-react";
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
  const [loadingData, setLoadingData] = useState(true); // Impostato a true di default
  const [isVoting, setIsVoting] = useState(false);
  const [nomeInput, setNomeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Stato per gestire la cancellazione
  const [deletingVote, setDeletingVote] = useState<string | null>(null);

  // Carica i dati in modo efficiente con useCallback
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [votiResponse, classificaResponse] = await Promise.all([
        fetch('/api/capo-stato/voti'),
        fetch('/api/capo-stato/classifica')
      ]);

      if (votiResponse.ok) {
        setUserVoti(await votiResponse.json());
      }
      if (classificaResponse.ok) {
        setClassifica(await classificaResponse.json());
      }
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
    if (!nomeInput.trim()) {
      toast({ title: "Errore", description: "Inserisci un nome valido", variant: "destructive" });
      return;
    }
    await voteForCandidate(nomeInput.trim());
  };

  const voteForCandidate = async (nome: string) => {
    if (userVoti.includes(nome)) {
      toast({ title: "Voto già registrato", description: `Hai già votato per ${nome}`, variant: "destructive" });
      return;
    }
    setIsVoting(true);
    try {
      const response = await fetch('/api/capo-stato/vota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      });
      if (response.ok) {
        toast({ title: "Voto registrato", description: `Hai votato ${nome} per Capo di Stato` });
        setNomeInput("");
        setShowSuggestions(false);
        await loadData(); // Ricarica tutti i dati per aggiornare UI
      } else {
        const error = await response.json();
        toast({ title: "Errore", description: error.error || "Errore nel registrare il voto", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  // ===== FUNZIONE DI RIMOZIONE VOTO CORRETTA =====
  const removeVote = async (nomeDaRimuovere: string) => {
    if (deletingVote) return; // Previene doppi click

    // Chiedi conferma
    if (!window.confirm(`Sei sicuro di voler rimuovere il voto per "${nomeDaRimuovere}"?`)) {
        return;
    }

    setDeletingVote(nomeDaRimuovere);
    try {
      // L'URL deve essere: /api/capo-stato/voti/NOME_CANDIDATO
      // encodeURIComponent è fondamentale per nomi con spazi o caratteri speciali
      const response = await fetch(`/api/capo-stato/voti/${encodeURIComponent(nomeDaRimuovere)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Voto rimosso",
          description: `Hai rimosso il voto per ${nomeDaRimuovere}`,
        });

        // Aggiorna lo stato locale per una UI più reattiva, senza ricaricare tutto
        setUserVoti(currentVotes => currentVotes.filter(voto => voto !== nomeDaRimuovere));
        // Ricarica la classifica in background se vuoi aggiornare i conteggi
        fetch('/api/capo-stato/classifica').then(res => res.json()).then(setClassifica);
      } else {
        const error = await response.json();
        toast({
          title: "Errore",
          description: error.error || "Errore nel rimuovere il voto",
          variant: "destructive",
        });
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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        {/* ===== NAVIGAZIONE INTERNA CORRETTA ===== */}
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full"><Crown className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">Capo di Stato</CardTitle>
            <CardDescription className="text-lg">Vota per il tuo candidato preferito (puoi esprimere più preferenze)</CardDescription>
          </CardHeader>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* Form di voto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Vote className="h-5 w-5" /><span>Il tuo voto</span></CardTitle>
                <CardDescription>Inserisci il nome del cittadino che vorresti come Capo di Stato.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVote} className="space-y-4">
                  {/* ... (resto del form, è già corretto) ... */}
                </form>

                {userVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">I tuoi voti:</h4>
                    <div className="flex flex-wrap gap-2">
                      {userVoti.map((voto, index) => (
                        // ===== BADGE CLICCABILE CON STATO DI CARICAMENTO =====
                        <Badge 
                          key={index} 
                          variant="default"
                          className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2"
                          onClick={() => removeVote(voto)}
                        >
                          {deletingVote === voto ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {voto}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Clicca su un nome per rimuovere il voto.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Classifica */}
            <Card>
              {/* ... (resto della classifica, è già corretta) ... */}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}