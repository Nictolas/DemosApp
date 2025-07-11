import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, Trophy, Plus, X, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, query, where } from "firebase/firestore";

interface Classifica { legge: string; voti: number; }

export default function Amnistia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [classifica, setClassifica] = useState<Classifica[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [leggeInput, setLeggeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deletingVote, setDeletingVote] = useState<string | null>(null);

  // Carica classifica e voti utente
  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    async function fetchData() {
      // Recupera tutti i voti
      const snapshot = await getDocs(collection(db, "voti_amnistia"));
      const votiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Classifica
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.legge) conteggio[v.legge] = (conteggio[v.legge] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([legge, voti]) => ({ legge, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      // Voti utente
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.legge);
      setUserVoti(mieiVoti);
      setLoadingData(false);
    }
    fetchData();
  }, [user]);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leggeInput.trim()) return;
    if (userVoti.includes(leggeInput.trim())) {
      toast({ title: "Voto già registrato", description: `Hai già votato per l'amnistia di: ${leggeInput.trim()}` });
      return;
    }
    setIsVoting(true);
    try {
      await addDoc(collection(db, "voti_amnistia"), {
        legge: leggeInput.trim(),
        userId: user.uid,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Voto registrato", description: `Hai votato per l'amnistia di: ${leggeInput.trim()}` });
      setLeggeInput("");
      // Ricarica dati
      const snapshot = await getDocs(collection(db, "voti_amnistia"));
      const votiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.legge) conteggio[v.legge] = (conteggio[v.legge] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([legge, voti]) => ({ legge, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.legge);
      setUserVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const removeVote = async (leggeDaRimuovere: string) => {
    if (deletingVote) return;
    if (!window.confirm(`Sei sicuro di voler rimuovere il voto per l'amnistia di "${leggeDaRimuovere}"?`)) return;
    setDeletingVote(leggeDaRimuovere);
    try {
      // Trova il documento da eliminare
      const q = query(collection(db, "voti_amnistia"), where("userId", "==", user.uid), where("legge", "==", leggeDaRimuovere));
      const snapshot = await getDocs(q);
      for (const docu of snapshot.docs) {
        await deleteDoc(docu.ref);
      }
      toast({ title: "Voto rimosso", description: `Hai rimosso il voto per l'amnistia di: ${leggeDaRimuovere}` });
      // Ricarica dati
      const allSnap = await getDocs(collection(db, "voti_amnistia"));
      const votiList = allSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.legge) conteggio[v.legge] = (conteggio[v.legge] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([legge, voti]) => ({ legge, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.legge);
      setUserVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setDeletingVote(null);
    }
  };

  const getSuggestions = () => {
    if (!leggeInput.trim() || !showSuggestions) return [];
    return classifica
      .filter(item => item.legge.toLowerCase().includes(leggeInput.toLowerCase()) && item.legge.toLowerCase() !== leggeInput.toLowerCase())
      .slice(0, 5);
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
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full"><FileText className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Amnistia</CardTitle>
            <CardDescription className="text-lg">Vota per l'amnistia di una legge. Puoi esprimere più preferenze.</CardDescription>
          </CardHeader>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><FileText className="h-5 w-5" /><span>La tua richiesta di amnistia</span></CardTitle>
                <CardDescription>Inserisci la legge per cui vuoi chiedere l'amnistia.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVote} className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Nome della legge..."
                        value={leggeInput}
                        onChange={(e) => { setLeggeInput(e.target.value); setShowSuggestions(true); }}
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
                              onClick={() => { setLeggeInput(suggestion.legge); setShowSuggestions(false); }}
                            >
                              {suggestion.legge} ({suggestion.voti} voti)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button type="submit" disabled={isVoting || !leggeInput.trim()}>
                      {isVoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Vota Amnistia
                    </Button>
                  </div>
                </form>

                {userVoti.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Le tue richieste di amnistia:</h4>
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
                <CardDescription>Le leggi che hanno ricevuto più richieste di amnistia</CardDescription>
              </CardHeader>
              <CardContent>
                {classifica.length > 0 ? (
                  <div className="space-y-3">
                    {classifica.map((item, index) => (
                      <div key={item.legge} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Button size="sm" variant="outline" onClick={() => setLeggeInput(item.legge)} disabled={isVoting} className="h-8 w-8 p-0"><ThumbsUp className="h-3 w-3" /></Button>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>#{index + 1}</div>
                          <span className="font-medium">{item.legge}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{item.voti} voti</Badge>
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