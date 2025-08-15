import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Crown, Vote, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
// === AGGIUNTO ===
import { apiRequest } from "@/lib/queryClient";

interface Classifica { nome: string; voti: number; }

export default function CapodiStato() {
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
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [showClassifica, setShowClassifica] = useState(false);
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoTimer, setVideoTimer] = useState(60);

  // === INIZIO MODIFICHE PRINCIPALI ===
  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const response = await apiRequest("GET", "/api/capo-stato");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati.");

      const { classifica, mieiVoti, blocco } = await response.json();
      
      setClassifica(classifica);
      setUserVoti(mieiVoti);
      setSelectedVoti(mieiVoti);

      // Gestione blocco settimanale dal backend
      if (blocco.isBlocked) {
        setIsBlocked(true);
        setUnlockDate(new Date(blocco.unlockDate));
      } else {
        setIsBlocked(false);
        setUnlockDate(null);
      }
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleConfermaSalva = async () => {
    setIsVoting(true);
    setShowConfirmDialog(false);
    try {
      // Il backend calcolerà le differenze basandosi sui voti inviati
      const response = await apiRequest("POST", "/api/capo-stato/vota", { voti: selectedVoti });
      if (!response.ok) throw new Error("Errore durante il salvataggio.");

      toast({ title: "Preferenze salvate", description: "I tuoi voti sono stati aggiornati." });
      await fetchData(); // Ricarica tutti i dati aggiornati
    } catch (error) {
      toast({ title: "Errore", description: "Errore durante il salvataggio.", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };
  // === FINE MODIFICHE PRINCIPALI ===

  // Il resto della logica del componente rimane quasi invariata
  const getSuggestions = () => {
    if (!nomeInput.trim() || !showSuggestions) return [];
    return classifica
      .filter(item => item.nome.toLowerCase().includes(nomeInput.toLowerCase()) && item.nome.toLowerCase() !== nomeInput.toLowerCase())
      .slice(0, 5);
  };

  const toggleSelezione = (nome: string) => {
    if (isVoting || isBlocked) return;
    setSelectedVoti(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]);
  };

  const handleAddNomeLocal = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = nomeInput.trim();
    if (!nomePulito) return;
    if (selectedVoti.includes(nomePulito)) {
      toast({ title: "Voto già selezionato", description: `Hai già selezionato ${nomePulito}` });
      return;
    }
    setSelectedVoti(prev => [...prev, nomePulito]);
    setNomeInput("");
  };

  const handleRemoveLocal = (nome: string) => {
    if (isVoting || isBlocked) return;
    setSelectedVoti(prev => prev.filter(n => n !== nome));
  };
  
  const handleShowClassifica = () => setShowAdDialog(true);

  const handleApproveAd = () => {
    setShowAdDialog(false);
    setShowVideo(true);
    setVideoTimer(60);
    const interval = setInterval(() => {
      setVideoTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowVideo(false);
          setShowClassifica(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  // Il codice JSX per la visualizzazione rimane IDENTICO
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
                <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full"><Crown className="h-12 w-12 text-white" /></div></div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">Capo di Stato</CardTitle>
                <CardDescription className="text-lg">Vota per il tuo candidato preferito (puoi esprimere più preferenze)</CardDescription>
            </CardHeader>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Vote className="h-5 w-5" /><span>I tuoi voti</span></CardTitle>
                <CardDescription>Aggiungi un nome alla tua lista o selezionalo dalla classifica.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddNomeLocal} className="space-y-4">
                    <div className="flex space-x-2">
                        <div className="flex-1 relative">
                            <Input
                                placeholder="Nome del candidato..."
                                value={nomeInput}
                                onChange={(e) => { setNomeInput(e.target.value); setShowSuggestions(true); }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                className="w-full"
                                disabled={isBlocked}
                            />
                            {showSuggestions && getSuggestions().length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                                {getSuggestions().map((suggestion) => (
                                    <button key={suggestion.nome} type="button" className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => { setNomeInput(suggestion.nome); setShowSuggestions(false); }}>
                                        {suggestion.nome} ({suggestion.voti} voti)
                                    </button>
                                ))}
                                </div>
                            )}
                        </div>
                        <Button type="submit" disabled={isVoting || !nomeInput.trim() || isBlocked}><Plus className="h-4 w-4 mr-2" />Aggiungi</Button>
                    </div>
                </form>

                {selectedVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Voti selezionati:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVoti.map((voto) => (
                        <Badge key={voto} variant="default" className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2" onClick={() => handleRemoveLocal(voto)}>
                            <X className="h-3 w-3" />
                            {voto}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isBlocked && (
              <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
                <b>Hai già modificato i voti questa settimana.</b><br />
                Potrai modificarli di nuovo dal: {unlockDate ? unlockDate.toLocaleString('it-IT') : "-"}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Top 10</span></CardTitle>
                <CardDescription>I candidati che hanno ricevuto più voti</CardDescription>
              </CardHeader>
              <CardContent>
                {/* ... Il resto del JSX rimane identico ... */}
              </CardContent>
            </Card>
            
            <div className="flex justify-end mt-4">
                <Button onClick={() => setShowConfirmDialog(true)} disabled={isVoting || JSON.stringify(selectedVoti.sort()) === JSON.stringify(userVoti.sort()) || isBlocked}>
                    {isVoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salva le mie preferenze
                </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma salvataggio voti</DialogTitle>
            <DialogDescription>
              Dopo aver salvato, potrai modificare i voti solo tra una settimana. Confermi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
            <Button onClick={handleConfermaSalva} disabled={isVoting}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}