import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Building2, User, Shield, Scale, Banknote, Briefcase, GraduationCap, Heart, Palette, Vote, Trophy, Leaf, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Classifica { nome: string; voti: number; }
interface VotiData {
  classifiche: { [categoria: string]: Classifica[] };
  mieiVoti: { [categoria: string]: string };
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

const ministeri = [
  { title: "Primo Ministro", categoria: "primo_ministro", icon: User, color: "bg-red-100 text-red-600" },
  { title: "Ministro degli Esteri", categoria: "esteri", icon: Building2, color: "bg-blue-100 text-blue-600" },
  // ... puoi aggiungere le descrizioni se vuoi mostrarle
  { title: "Ministro dell'Interno", categoria: "interno", icon: Shield, color: "bg-green-100 text-green-600" },
  { title: "Ministro della Giustizia", categoria: "giustizia", icon: Scale, color: "bg-purple-100 text-purple-600" },
  { title: "Ministro della Difesa", categoria: "difesa", icon: Shield, color: "bg-gray-100 text-gray-600" },
  { title: "Ministro dell'Economia", categoria: "economia", icon: Banknote, color: "bg-yellow-100 text-yellow-600" },
  { title: "Ministro del Lavoro", categoria: "lavoro", icon: Briefcase, color: "bg-orange-100 text-orange-600" },
  { title: "Ministro dell'Istruzione", categoria: "istruzione", icon: GraduationCap, color: "bg-indigo-100 text-indigo-600" },
  { title: "Ministro della Salute", categoria: "salute", icon: Heart, color: "bg-pink-100 text-pink-600" },
  { title: "Ministro della Cultura", categoria: "cultura", icon: Palette, color: "bg-teal-100 text-teal-600" },
  { title: "Ministro dell'Ambiente", categoria: "ambiente_sicurezza_energetica", icon: Leaf, color: "bg-lime-100 text-lime-600" }
];

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVoti, setSelectedVoti] = useState<{ [categoria: string]: string }>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<{ [categoria: string]: boolean }>({});

  // 1. Caricamento dati con React Query
  const { data, isLoading: isLoadingData } = useQuery<VotiData>({
    queryKey: ['governoVoti'],
    queryFn: async () => {
        const response = await apiRequest("GET", "/api/governo/voti");
        if (!response.ok) throw new Error("Errore nel caricamento dei dati del governo.");
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

  // 2. Mutazione per salvare tutti i voti in blocco
  const saveVotiMutation = useMutation({
    mutationFn: (voti: { [categoria: string]: string }) => apiRequest("POST", "/api/governo/vota", { voti }),
    onSuccess: () => {
        toast({ title: "Preferenze salvate", description: "Le tue scelte per il governo sono state aggiornate." });
        queryClient.invalidateQueries({ queryKey: ['governoVoti'] }); // Ricarica i dati
    },
    onError: (error: any) => {
        toast({ title: "Errore", description: error.message || "Impossibile salvare le preferenze.", variant: "destructive" });
    },
    onSettled: () => {
        setShowConfirmDialog(false);
    }
  });
  
  const handleChangeMinistro = (categoria: string, nome: string) => {
    if (data?.blocco.isBlocked) return;
    setSelectedVoti(prev => ({ ...prev, [categoria]: nome.trim() }));
  };
  
  const handleRemoveVoto = (categoria: string) => {
    if (data?.blocco.isBlocked) return;
    // Crea una copia dell'oggetto e rimuovi la chiave
    const newVoti = { ...selectedVoti };
    delete newVoti[categoria];
    setSelectedVoti(newVoti);
  };

  const handleSalvaVoti = () => {
    if (data?.blocco.isBlocked) {
        toast({ title: "Bloccato", description: "Puoi modificare i voti solo una volta a settimana.", variant: "destructive" });
        return;
    }
    setShowConfirmDialog(true);
  };

  // Logica per espandere/comprimere le categorie
  const toggleCategoryExpansion = (categoria: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };
  
  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const unlockDate = data?.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleString('it-IT') : null;
  const votiCambiati = JSON.stringify(selectedVoti) !== JSON.stringify(data?.mieiVoti || {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-7xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => window.location.href = "/preferiti"}><ArrowLeft className="mr-2 h-4 w-4" />Torna ai Preferiti</Button>
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full"><Building2 className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold">Il Tuo Governo Ideale</CardTitle>
            <CardDescription className="text-lg">Scegli chi vorresti a capo di ogni ministero.</CardDescription>
          </CardHeader>
        </Card>

        {data?.blocco.isBlocked && unlockDate && (
          <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
            <b>Hai già modificato le tue preferenze questa settimana.</b><br />
            Potrai modificarle di nuovo dal: {unlockDate}
          </div>
        )}

        {isLoadingData ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ministeri.map((ministero) => (
                    <Card key={ministero.categoria} className="flex flex-col">
                        <CardHeader>
                            <div className="flex items-center justify-between mb-2">
                                <div className={`p-3 rounded-lg ${ministero.color}`}><ministero.icon className="h-6 w-6" /></div>
                                {data?.mieiVoti[ministero.categoria] && <Badge variant="default"><Vote className="h-3 w-3 mr-1" />Votato</Badge>}
                            </div>
                            <CardTitle className="text-lg">{ministero.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex space-x-2">
                                    <Input placeholder="Nome del candidato..." value={selectedVoti[ministero.categoria] || ""} onChange={e => handleChangeMinistro(ministero.categoria, e.target.value)} disabled={data?.blocco.isBlocked} />
                                    {selectedVoti[ministero.categoria] && <Button size="icon" variant="destructive" onClick={() => handleRemoveVoto(ministero.categoria)} disabled={data?.blocco.isBlocked}><X className="h-4 w-4" /></Button>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center"><Trophy className="h-4 w-4 mr-1 text-yellow-500" />Classifica Candidati</h4>
                                {data?.classifiche[ministero.categoria]?.length > 0 ? (
                                    <div className="space-y-2">
                                        {/* Primi 3 candidati sempre visibili */}
                                        <div className="space-y-1">
                                            {data?.classifiche[ministero.categoria]?.slice(0, 3).map((candidato, index) => (
                                                <div key={candidato.nome} className="flex items-center justify-between p-2 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-full text-xs font-bold">
                                                            {index + 1}
                                                        </div>
                                                        <span className="font-medium text-sm">{candidato.nome}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-xs">{candidato.voti} voti</Badge>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Candidati rimanenti (espandibili) */}
                                        {data?.classifiche[ministero.categoria] && data.classifiche[ministero.categoria].length > 3 && (
                                            <div className="space-y-2">
                                                {/* Pulsante per espandere/comprimere */}
                                                <Button 
                                                    onClick={() => toggleCategoryExpansion(ministero.categoria)} 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-300 text-xs"
                                                >
                                                    <Trophy className="h-3 w-3 mr-1 text-blue-600" />
                                                    {expandedCategories[ministero.categoria] && data?.classifiche[ministero.categoria]
                                                        ? `Nascondi (${data.classifiche[ministero.categoria].length - 3} candidati)` 
                                                        : `Mostra Altro (${data.classifiche[ministero.categoria].length - 3} candidati rimanenti)`
                                                    }
                                                </Button>
                                                
                                                {/* Candidati rimanenti (animati) */}
                                                {expandedCategories[ministero.categoria] && data?.classifiche[ministero.categoria] && (
                                                    <div className="space-y-1 transition-all duration-500 ease-out">
                                                        {data.classifiche[ministero.categoria].slice(3).map((candidato, index) => (
                                                            <div key={candidato.nome} className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300">
                                                                <div className="flex items-center space-x-2">
                                                                    <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-600 text-white rounded-full text-xs font-bold">
                                                                        {index + 4}
                                                                    </div>
                                                                    <span className="font-medium text-sm">{candidato.nome}</span>
                                                                </div>
                                                                <Badge variant="outline" className="text-xs">{candidato.voti} voti</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : <p className="text-xs text-muted-foreground">Nessun voto ancora registrato.</p>}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
            <div className="container mx-auto max-w-7xl flex justify-end">
                <Button size="lg" onClick={handleSalvaVoti} disabled={saveVotiMutation.isPending || data?.blocco.isBlocked || !votiCambiati}>
                    {saveVotiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salva le Tue Preferenze
                </Button>
            </div>
        </div>

        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Conferma salvataggio</DialogTitle>
                    <DialogDescription>Dopo aver salvato, potrai modificare le preferenze solo tra una settimana. Sei sicuro?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
                    <Button onClick={() => saveVotiMutation.mutate(selectedVoti)}>Conferma</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
