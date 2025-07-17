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
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, query, where, doc, updateDoc, getDoc } from "firebase/firestore";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

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
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [showClassifica, setShowClassifica] = useState(false);
  const [adTimer, setAdTimer] = useState(0);

  // Funzione per mostrare la classifica dopo la pubblicità
  const handleShowClassifica = () => {
    setAdTimer(5); // 5 secondi di "pubblicità"
    const interval = setInterval(() => {
      setAdTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowClassifica(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Carica classifica e voti utente
  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    async function fetchData() {
      // Recupera tutti i voti
      const snapshot = await getDocs(collection(db, "voti_grazia"));
      const votiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Classifica
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.nome) conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      // Voti utente
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.nome);
      setUserVoti(mieiVoti);
      setSelectedVoti(mieiVoti); // Inizializza la selezione
      setLoadingData(false);
    }
    fetchData();
  }, [user]);

  // Controllo blocco settimanale
  useEffect(() => {
    if (!user) return;
    if (user.ruolo === "Admin") {
      setIsBlocked(false);
      setUnlockDate(null);
      return;
    }
    const lastEdit = user.lastGraziaEdit ? new Date(user.lastGraziaEdit) : null;
    if (lastEdit) {
      const now = new Date();
      const diff = now.getTime() - lastEdit.getTime();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      if (diff < weekMs) {
        setIsBlocked(true);
        setUnlockDate(new Date(lastEdit.getTime() + weekMs));
      } else {
        setIsBlocked(false);
        setUnlockDate(null);
      }
    } else {
      setIsBlocked(false);
      setUnlockDate(null);
    }
  }, [user]);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeInput.trim()) return;
    if (userVoti.includes(nomeInput.trim())) {
      toast({ title: "Voto già registrato", description: `Hai già votato per ${nomeInput.trim()}` });
      return;
    }
    setIsVoting(true);
    try {
      await addDoc(collection(db, "voti_grazia"), {
        nome: nomeInput.trim(),
        userId: user.uid,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Voto registrato", description: `Hai votato ${nomeInput.trim()}` });
      setNomeInput("");
      // Ricarica dati
      const snapshot = await getDocs(collection(db, "voti_grazia"));
      const votiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.nome) conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.nome);
      setUserVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  // Funzione per votare direttamente dalla classifica
  const handleVoteForName = async (nome: string) => {
    if (userVoti.includes(nome)) {
      toast({ title: "Voto già registrato", description: `Hai già votato per ${nome}` });
      return;
    }
    setIsVoting(true);
    try {
      await addDoc(collection(db, "voti_grazia"), {
        nome: nome,
        userId: user.uid,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Voto registrato", description: `Hai votato ${nome}` });
      // Ricarica dati
      const snapshot = await getDocs(collection(db, "voti_grazia"));
      const votiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.nome) conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.nome);
      setUserVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const removeVote = async (nomeDaRimuovere: string) => {
    if (deletingVote) return;
    if (!window.confirm(`Sei sicuro di voler rimuovere la richiesta di grazia per "${nomeDaRimuovere}"?`)) return;
    setDeletingVote(nomeDaRimuovere);
    try {
      // Trova il documento da eliminare
      const q = query(collection(db, "voti_grazia"), where("userId", "==", user.uid), where("nome", "==", nomeDaRimuovere));
      const snapshot = await getDocs(q);
      for (const docu of snapshot.docs) {
        await deleteDoc(docu.ref);
      }
      toast({ title: "Richiesta rimossa", description: `Hai rimosso la richiesta per ${nomeDaRimuovere}` });
      // Ricarica dati
      const allSnap = await getDocs(collection(db, "voti_grazia"));
      const votiList = allSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.nome) conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.nome);
      setUserVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setDeletingVote(null);
    }
  };

  // Gestione selezione batch
  const toggleSelezione = (nome: string) => {
    if (isVoting) return;
    setSelectedVoti(prev =>
      prev.includes(nome)
        ? prev.filter(n => n !== nome)
        : [...prev, nome]
    );
  };

  // Salva batch con dialog di conferma
  const handleSalvaVoti = async () => {
    setShowConfirmDialog(true);
  };

  const handleConfermaSalva = async () => {
    setIsVoting(true);
    setShowConfirmDialog(false);
    try {
      // Calcola differenze
      const daAggiungere = selectedVoti.filter(n => !userVoti.includes(n));
      const daRimuovere = userVoti.filter(n => !selectedVoti.includes(n));
      // Aggiungi nuovi voti
      for (const nome of daAggiungere) {
        await addDoc(collection(db, "voti_grazia"), {
          nome,
          userId: user.uid,
          timestamp: new Date().toISOString()
        });
      }
      // Rimuovi voti tolti
      for (const nome of daRimuovere) {
        const q = query(collection(db, "voti_grazia"), where("userId", "==", user.uid), where("nome", "==", nome));
        const snapshot = await getDocs(q);
        for (const docu of snapshot.docs) {
          await deleteDoc(docu.ref);
        }
      }
      // Aggiorna lastGraziaEdit
      const userDocRef = doc(db, "utenti", user.uid);
      await updateDoc(userDocRef, { lastGraziaEdit: new Date().toISOString() });
      toast({ title: "Preferenze salvate", description: "Le tue richieste di grazia sono state aggiornate." });
      // Ricarica dati
      const snapshot = await getDocs(collection(db, "voti_grazia"));
      const votiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const conteggio: Record<string, number> = {};
      votiList.forEach(v => {
        if (v.nome) conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
      });
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      const mieiVoti = votiList.filter(v => v.userId === user.uid).map(v => v.nome);
      setUserVoti(mieiVoti);
      setSelectedVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const getSuggestions = () => {
    if (!nomeInput.trim() || !showSuggestions) return [];
    return classifica
      .filter(item => item.nome.toLowerCase().includes(nomeInput.toLowerCase()) && item.nome.toLowerCase() !== nomeInput.toLowerCase())
      .slice(0, 5);
  };

  // Nuova funzione per aggiungere un nome solo localmente
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

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

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
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full"><Scale className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">Grazia</CardTitle>
            <CardDescription className="text-lg">Vota per chiedere la grazia a favore di un carcerato. Puoi esprimere più preferenze.</CardDescription>
          </CardHeader>
        </Card>

        {isBlocked && (
          <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
            <b>Hai già modificato le richieste di grazia questa settimana.</b><br />
            Potrai modificarle di nuovo dal: {unlockDate ? unlockDate.toLocaleString() : "-"}
          </div>
        )}

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
                <form onSubmit={handleAddNomeLocal} className="space-y-4">
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
                              {suggestion.nome} ({suggestion.voti} richieste)
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
                      {selectedVoti.map((voto, index) => (
                        <Badge
                          key={index}
                          variant="default"
                          className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2"
                          onClick={() => setSelectedVoti(prev => prev.filter(n => n !== voto))}
                        >
                          <X className="h-3 w-3" />
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
                {/* Solo Admin vede subito la classifica */}
                {user?.ruolo === "Admin" ? (
                  classifica.length > 0 ? (
                    <div className="space-y-3">
                      {classifica.map((carcerato, index) => {
                        const selezionato = selectedVoti.includes(carcerato.nome);
                        return (
                          <div key={carcerato.nome} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Button size="sm" variant={selezionato ? "default" : "outline"} onClick={() => toggleSelezione(carcerato.nome)} disabled={isVoting} className={`h-8 w-8 p-0 ${selezionato ? "bg-green-600 text-white" : ""}`}> <ThumbsUp className="h-3 w-3" /> </Button>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>#{index + 1}</div>
                              <span className="font-medium">{carcerato.nome}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{carcerato.voti} richieste</Badge>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSalvaVoti} disabled={isVoting || JSON.stringify(selectedVoti.sort()) === JSON.stringify(userVoti.sort()) || isBlocked}>
                          {isVoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Salva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nessuna richiesta ancora registrata.</p>
                  )
                ) : !showClassifica ? (
                  <div className="flex flex-col items-center space-y-4">
                    {adTimer > 0 ? (
                      <div className="text-center">
                        <div className="mb-2 font-semibold">Pubblicità...<br/>La classifica sarà visibile tra {adTimer} secondi</div>
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      </div>
                    ) : (
                      <Button onClick={handleShowClassifica} className="w-full max-w-xs">Mostra classifica</Button>
                    )}
                  </div>
                ) : (
                  classifica.length > 0 ? (
                    <div className="space-y-3">
                      {classifica.map((carcerato, index) => {
                        const selezionato = selectedVoti.includes(carcerato.nome);
                        return (
                          <div key={carcerato.nome} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Button size="sm" variant={selezionato ? "default" : "outline"} onClick={() => toggleSelezione(carcerato.nome)} disabled={isVoting || isBlocked} className={`h-8 w-8 p-0 ${selezionato ? "bg-green-600 text-white" : ""}`}> <ThumbsUp className="h-3 w-3" /> </Button>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>#{index + 1}</div>
                              <span className="font-medium">{carcerato.nome}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{carcerato.voti} richieste</Badge>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-end mt-4">
                        <Button onClick={handleSalvaVoti} disabled={isVoting || JSON.stringify(selectedVoti.sort()) === JSON.stringify(userVoti.sort()) || isBlocked}>
                          {isVoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Salva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nessuna richiesta ancora registrata.</p>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma salvataggio richieste di grazia</DialogTitle>
            <DialogDescription>
              Dopo aver salvato, potrai modificare le richieste di grazia solo tra una settimana. Confermi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annulla</Button>
            </DialogClose>
            <Button onClick={handleConfermaSalva} disabled={isVoting}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}