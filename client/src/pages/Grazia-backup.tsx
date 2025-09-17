import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Classifica { nome: string; richieste: number; }
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
  const [showAllClassifica, setShowAllClassifica] = useState(false);

  // 1. Caricamento dati con React Query
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    queryKey: ['graziaData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/grazia avviata');
      const response = await apiRequest("GET", "/grazia");
      console.log('🔍 DEBUG: Risposta ricevuta:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API /grazia:', errorData);
        throw new Error(`Errore ${response.status}: ${errorData}`);
      }
      const result = await response.json();
      console.log('✅ Dati grazia ricevuti:', result);
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
  
  // Logica per espandere la classifica
  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const unlockDate = data?.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleString('it-IT') : null;
  const votiCambiati = JSON.stringify(selectedVoti.sort()) !== JSON.stringify(data?.mieiVoti.sort() || []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
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
        ) : error ? (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded">
            <b>Errore nel caricamento dei dati:</b><br />
            {error.message}
          </div>
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
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Carcerati</span></CardTitle>
                <CardDescription>I carcerati con più richieste di grazia ({data?.classifica?.length || 0} totali)</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.classifica && data.classifica.length > 0 ? (
                  <div className="space-y-4">
                    {/* Primi 3 carcerati sempre visibili */}
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
                                {item.richieste} richieste
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleSelezioneClassifica(item.nome)}
                            disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                            className={`transition-all duration-300 ${
                              selectedVoti.includes(item.nome) 
                                ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 shadow-md" 
                                : "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                            }`}
                          >
                            {selectedVoti.includes(item.nome) ? (
                              <>
                                <ThumbsUp className="h-4 w-4 mr-2" />
                                Selezionato
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Seleziona
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Carcerati rimanenti (espandibili) */}
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
                              ? `Nascondi (${data.classifica.length - 3} carcerati)` 
                              : `Mostra Altro (${data.classifica.length - 3} carcerati rimanenti)`
                            }
                          </Button>
                        </div>
                        
                        {/* Carcerati rimanenti (animati) */}
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
                                      {item.richieste} richieste
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleSelezioneClassifica(item.nome)}
                                  disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                                  className={`transition-all duration-300 ${
                                    selectedVoti.includes(item.nome) 
                                      ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 shadow-md" 
                                      : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                                  }`}
                                >
                                  {selectedVoti.includes(item.nome) ? (
                                    <>
                                      <ThumbsUp className="h-4 w-4 mr-2" />
                                      Selezionato
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4 mr-2" />
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
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Trophy className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-600">Nessuna classifica disponibile al momento</p>
                    <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
                  </div>
                )}
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
