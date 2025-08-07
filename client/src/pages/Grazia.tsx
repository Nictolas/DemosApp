import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Classifica { nome: string; voti: number; }
interface GraziaData {
  classifica: Classifica[];
  mieiVoti: string[];
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

export default function Grazia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nomeInput, setNomeInput] = useState("");
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showClassifica, setShowClassifica] = useState(false);
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoTimer, setVideoTimer] = useState(60);

  // 1. Caricamento dati con React Query
  const { data, isLoading: isLoadingData } = useQuery<GraziaData>({
    queryKey: ['graziaData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/grazia");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati.");
      return response.json();
    },
    enabled: !!user,
    onSuccess: (fetchedData) => {
      setSelectedVoti(fetchedData.mieiVoti || []);
    }
  });

  // 2. Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/grazia/vota", { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "Le tue richieste di grazia sono state aggiornate." });
      queryClient.invalidateQueries({ queryKey: ['graziaData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le richieste.", variant: "destructive" });
    },
    onSettled: () => {
      setShowConfirmDialog(false);
    }
  });

  // Logica locale per aggiungere/rimuovere voti dalla selezione temporanea
  const handleAddNomeLocal = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = nomeInput.trim();
    if (!nomePulito) return;
    if (selectedVoti.includes(nomePulito)) {
      toast({ title: "Richiesta già selezionata" });
      return;
    }
    setSelectedVoti(prev => [...prev, nomePulito]);
    setNomeInput("");
  };

  const handleRemoveLocal = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev => prev.filter(n => n !== nome));
  };
  
  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]);
  };
  
  // Logica per Pubblicità e Classifica (invariata)
  const handleShowClassifica = () => setShowAdDialog(true);
  const handleApproveAd = () => {
    setShowAdDialog(false);
    setShowVideo(true);
    setVideoTimer(60);
    const interval = setInterval(() => {
      setVideoTimer(prev => {
        if (prev <= 1) { clearInterval(interval); setShowVideo(false); setShowClassifica(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const unlockDate = data?.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleString('it-IT') : null;
  const votiCambiati = JSON.stringify(selectedVoti.sort()) !== JSON.stringify(data?.mieiVoti.sort() || []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/vota"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna a Vota</Button></Link>
        <Card className="mb-6">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full"><Scale className="h-12 w-12 text-white" /></div></div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">Grazia</CardTitle>
                <CardDescription className="text-lg">Vota per chiedere la grazia a favore di un carcerato.</CardDescription>
            </CardHeader>
        </Card>

        {data?.blocco.isBlocked && (
          <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
            <b>Hai già modificato le richieste questa settimana.</b><br />
            Potrai farlo di nuovo dal: {unlockDate || "-"}
          </div>
        )}

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Scale className="h-5 w-5" /><span>La tua richiesta di grazia</span></CardTitle>
                <CardDescription>Inserisci il nome del carcerato per cui vuoi chiedere la grazia.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddNomeLocal} className="space-y-4">
                  <div className="flex space-x-2">
                    <Input placeholder="Nome del carcerato..." value={nomeInput} onChange={(e) => setNomeInput(e.target.value)} disabled={data?.blocco.isBlocked}/>
                    <Button type="submit" disabled={saveVotiMutation.isPending || !nomeInput.trim() || data?.blocco.isBlocked}><Plus className="h-4 w-4 mr-2" />Chiedi Grazia</Button>
                  </div>
                </form>

                {selectedVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Le tue richieste selezionate:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVoti.map((voto) => (
                        <Badge key={voto} variant="default" className="cursor-pointer hover:bg-destructive/90" onClick={() => handleRemoveLocal(voto)}><X className="h-3 w-3 mr-1" />{voto}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Top 10</span></CardTitle>
                <CardDescription>I carcerati con più richieste di grazia</CardDescription>
              </CardHeader>
              <CardContent>
                {/* ... JSX per la classifica e la pubblicità (invariato) ... */}
              </CardContent>
            </Card>

            <div className="flex justify-end mt-4">
                <Button onClick={() => setShowConfirmDialog(true)} disabled={saveVotiMutation.isPending || !votiCambiati || data?.blocco.isBlocked}>
                    {saveVotiMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Salva le mie Richieste
                </Button>
            </div>
          </div>
        )}
      </div>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma salvataggio</DialogTitle>
            <DialogDescription>Dopo aver salvato, potrai modificare le richieste solo tra una settimana. Confermi?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
            <Button onClick={() => saveVotiMutation.mutate(selectedVoti)} disabled={saveVotiMutation.isPending}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}