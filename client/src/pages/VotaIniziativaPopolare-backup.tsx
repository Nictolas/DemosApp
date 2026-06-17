import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Iniziativa {
  id: string;
  nome: string;
  sitoWeb?: string;
  quorum: string;
}

interface Classifica {
  nome: string;
  voti: number;
}

interface IniziativePopolariData {
  iniziative: Iniziativa[];
  classifica: Classifica[];
  mieiVoti: string[];
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

export default function VotaIniziativaPopolare() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showAllClassifica, setShowAllClassifica] = useState(false);

  // 1. Caricamento dati con React Query
  const { data, isLoading: isLoadingData, error } = useQuery<IniziativePopolariData>({
    queryKey: ['iniziativePopolariData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/iniziative-popolari avviata');
      const response = await apiRequest("GET", "/api/iniziative-popolari");
      console.log('🔍 DEBUG: Risposta ricevuta:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API /iniziative-popolari:', errorData);
        throw new Error(`Errore ${response.status}: ${errorData}`);
      }
      const result = await response.json();
      console.log('✅ Dati iniziative popolari ricevuti:', result);
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
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/iniziative-popolari/vota", { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "Le tue preferenze per le iniziative popolari sono state aggiornate." });
      queryClient.invalidateQueries({ queryKey: ['iniziativePopolariData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le preferenze.", variant: "destructive" });
    },
    onSettled: () => {
      setShowConfirmDialog(false);
    }
  });

  // Logica locale per gestire i voti
  const toggleSelezione = (id: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id]
    );
  };

  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    const iniziativa = data?.iniziative.find(i => i.nome === nome);
    if (iniziativa) {
      toggleSelezione(iniziativa.id);
    }
  };

  // Logica per espandere la classifica
  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const unlockDate = data?.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleString('it-IT') : null;
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/vota"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna a Vota</Button></Link>
        <Card className="mb-6">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full"><Scale className="h-12 w-12 text-white" /></div></div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Iniziative Popolari</CardTitle>
                <CardDescription className="text-lg">Vota le iniziative popolari che hanno raggiunto il quorum.</CardDescription>
            </CardHeader>
        </Card>

        {data?.blocco.isBlocked && (
          <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
            <b>Hai già modificato le preferenze questa settimana.</b><br />
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
                <CardTitle className="flex items-center space-x-2"><Scale className="h-5 w-5" /><span>Le tue preferenze per le iniziative popolari</span></CardTitle>
                <CardDescription>Seleziona le iniziative popolari che preferisci.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Le tue iniziative selezionate:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVoti.map((id) => {
                        const iniziativa = data?.iniziative.find(i => i.id === id);
                        return iniziativa ? (
                          <Badge key={id} variant="default" className="cursor-pointer hover:bg-destructive/90" onClick={() => toggleSelezione(id)}>
                            <X className="h-3 w-3 mr-1" />
                            {iniziativa.sitoWeb ? (
                              <a
                                href={iniziativa.sitoWeb}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white underline hover:text-blue-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {iniziativa.nome}
                              </a>
                            ) : (
                              iniziativa.nome
                            )}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Iniziative Popolari</span></CardTitle>
                <CardDescription>Le iniziative popolari con più voti ({data?.classifica?.length || 0} totali)</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.classifica && data.classifica.length > 0 ? (
                  <div className="space-y-4">
                    {/* Primi 3 iniziative sempre visibili */}
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
                            onClick={() => toggleSelezioneClassifica(item.nome)}
                            disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                            className={`transition-all duration-300 ${
                              data.iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(data.iniziative.find(i => i.nome === item.nome)!.id)
                                ? "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200 shadow-md" 
                                : "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                            }`}
                          >
                            {data.iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(data.iniziative.find(i => i.nome === item.nome)!.id) ? (
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
                    
                    {/* Iniziative rimanenti (espandibili) */}
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
                              ? `Nascondi (${data.classifica.length - 3} iniziative)` 
                              : `Mostra Altro (${data.classifica.length - 3} iniziative rimanenti)`
                            }
                          </Button>
                        </div>
                        
                        {/* Iniziative rimanenti (animati) */}
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
                                  onClick={() => toggleSelezioneClassifica(item.nome)}
                                  disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                                  className={`transition-all duration-300 ${
                                    data.iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(data.iniziative.find(i => i.nome === item.nome)!.id)
                                      ? "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200 shadow-md" 
                                      : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                                  }`}
                                >
                                  {data.iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(data.iniziative.find(i => i.nome === item.nome)!.id) ? (
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
                    Salva le mie Preferenze
                </Button>
            </div>
          </div>
        )}
      </div>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma salvataggio</DialogTitle>
            <DialogDescription>Dopo aver salvato, potrai modificare le preferenze solo tra una settimana. Confermi?</DialogDescription>
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
