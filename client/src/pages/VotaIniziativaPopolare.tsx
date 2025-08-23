import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsUp, X, Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { data, isLoading: isLoadingData } = useQuery<IniziativePopolariData>({
    queryKey: ['iniziativePopolariData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/iniziative-popolari");
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

  // 2. Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/iniziative-popolari/vota", { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "Le tue preferenze sono state aggiornate." });
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

  const handleSalvaVoti = () => {
    if (data?.blocco.isBlocked) {
      toast({ title: "Bloccato", description: "Puoi modificare le preferenze solo una volta a settimana.", variant: "destructive" });
      return;
    }
    setShowConfirmDialog(true);
  };

  // Logica per espandere la classifica
  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const unlockDate = data?.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleString('it-IT') : null;
  const votiCambiati = JSON.stringify(selectedVoti.sort()) !== JSON.stringify(data?.mieiVoti.sort() || []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800" style={{ paddingBottom: '80px' }}>
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Iniziative Popolari con Quorum Raggiunto</CardTitle>
            <CardDescription>Vota le iniziative popolari che hanno raggiunto il quorum. Le più votate sono in cima.</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.blocco.isBlocked && (
              <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
                <b>Hai già modificato le preferenze questa settimana.</b><br />
                Potrai modificarle di nuovo dal: {unlockDate}
              </div>
            )}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Le tue preferenze:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedVoti.map((id, index) => {
                  const iniziativa = data?.iniziative.find(i => i.id === id);
                  return iniziativa ? (
                    <span key={id} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      <X className="h-3 w-3 mr-1 cursor-pointer" onClick={() => setSelectedVoti(prev => prev.filter(n => n !== id))} />
                      {iniziativa.nome}
                    </span>
                  ) : null;
                })}
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleSalvaVoti} disabled={saveVotiMutation.isPending || !votiCambiati || data?.blocco.isBlocked}>
                  {saveVotiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salva
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Voti</TableHead>
                    <TableHead>Seleziona</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.iniziative.map((iniziativa: Iniziativa) => {
                    const selezionato = selectedVoti.includes(iniziativa.id);
                    return (
                      <TableRow key={iniziativa.id}>
                        <TableCell className="font-medium">
                          {iniziativa.sitoWeb ? (
                            <a
                              href={iniziativa.sitoWeb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline hover:text-blue-900 cursor-pointer"
                            >
                              {iniziativa.nome}
                            </a>
                          ) : (
                            <span>{iniziativa.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>{data.classifica.find(c => c.nome === iniziativa.nome)?.voti || 0}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={selezionato ? "default" : "outline"}
                            onClick={() => toggleSelezione(iniziativa.id)}
                            disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" /> {selezionato ? "Selezionato" : "Seleziona"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data?.iniziative.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">Nessuna iniziativa ha raggiunto il quorum.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* PUBBLICITÀ E CLASSIFICA */}
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2"><Trophy className="h-5 w-5 text-yellow-500" /><span>Classifica Iniziative</span></CardTitle>
                  <CardDescription>Le iniziative popolari che hanno ricevuto più voti ({data?.classifica?.length || 0} totali)</CardDescription>
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
                              onClick={() => {
                                const iniziativa = data.iniziative.find(i => i.nome === item.nome);
                                if (iniziativa) toggleSelezione(iniziativa.id);
                              }}
                              disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                              className="hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700 transition-all duration-300"
                            >
                              <ThumbsUp className="h-4 w-4 mr-2" />
                              {data.iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(data.iniziative.find(i => i.nome === item.nome)!.id) ? "Selezionato" : "Seleziona"}
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
                                    onClick={() => {
                                      const iniziativa = data.iniziative.find(i => i.nome === item.nome);
                                      if (iniziativa) toggleSelezione(iniziativa.id);
                                    }}
                                    disabled={saveVotiMutation.isPending || data?.blocco.isBlocked}
                                    className="hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all duration-300"
                                  >
                                    <ThumbsUp className="h-4 w-4 mr-2" />
                                    {data.iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(data.iniziative.find(i => i.nome === item.nome)!.id) ? "Selezionato" : "Seleziona"}
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
            {/* Dialog di conferma salvataggio */}
            {showConfirmDialog && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                  <h2 className="text-lg font-bold mb-2">Conferma salvataggio preferenze</h2>
                  <p className="mb-4">Dopo aver salvato, potrai modificare le preferenze solo tra una settimana. Confermi?</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
                    <Button onClick={() => saveVotiMutation.mutate(selectedVoti)} disabled={saveVotiMutation.isPending}>Conferma</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 