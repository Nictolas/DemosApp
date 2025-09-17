import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, MessageSquare, ThumbsUp, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";



interface OpinioneProposta {
  id: string;
  testo: string;
  voti: number;
  proponente: string;
}

export default function ProponiOpinione() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [opinioni, setOpinioni] = useState<OpinioneProposta[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [testoInput, setTestoInput] = useState("");
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [showClassifica, setShowClassifica] = useState(false);
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoTimer, setVideoTimer] = useState(60);

  // Carica opinioni proposte e voti utente direttamente da Firestore
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const snap = await getDocs(collection(db, "opinioni_proposte"));
      const arr = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setOpinioni(arr.map(op => ({
        id: op.id,
        testo: op.testo,
        voti: op.voti || 0,
        proponente: op.proponente || "",
        votanti: op.votanti || [],
      })));
      const mieiVoti = arr.filter(op => (op.votanti || []).includes(user.uid)).map(op => op.id);
      setUserVoti(mieiVoti);
      setSelectedVoti(mieiVoti);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Blocco settimanale
  useEffect(() => {
    if (!user) return;
    if (user.ruolo === "Admin") {
      setIsBlocked(false);
      setUnlockDate(null);
      return;
    }
    const lastEdit = user.lastProponiOpinioneEdit ? new Date(user.lastProponiOpinioneEdit) : null;
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

  // Selezione batch
  const toggleSelezione = (id: string) => {
    if (isVoting || isBlocked) return;
    setSelectedVoti(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id]
    );
  };

  // Salva batch con dialog di conferma
  const handleSalvaVoti = () => {
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
      for (const id of daAggiungere) {
        const ref = doc(db, "opinioni_proposte", id);
        await updateDoc(ref, {
          votanti: arrayUnion(user.uid),
          voti: increment(1),
        });
      }
      // Rimuovi voti tolti
      for (const id of daRimuovere) {
        const ref = doc(db, "opinioni_proposte", id);
        await updateDoc(ref, {
          votanti: arrayRemove(user.uid),
          voti: increment(-1),
        });
      }
      // Aggiorna lastProponiOpinioneEdit
      const userDocRef = doc(db, "utenti", user.uid);
      await updateDoc(userDocRef, { lastProponiOpinioneEdit: new Date().toISOString() });
      toast({ title: "Preferenze salvate", description: "Le tue preferenze sono state aggiornate." });
      loadData();
    } catch (error) {
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  // Pubblicità fittizia prima della classifica
  const handleShowClassifica = () => {
    setShowAdDialog(true);
  };
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

  // Proponi nuova opinione direttamente su Firestore
  const handleProponi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testoInput.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "opinioni_proposte"), {
        testo: testoInput.trim(),
        voti: 0,
        proponente: user.uid,
        proponente_email: user.email,
        data_creazione: new Date().toISOString(),
        votanti: [],
      });
      toast({ title: "Opinione proposta!", description: "La tua proposta sarà valutata dall'admin." });
      setTestoInput("");
      loadData();
    } catch (error) {
      toast({ title: "Errore", description: "Errore nell'invio della proposta", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Vota opinione direttamente su Firestore
  const handleVota = async (id: string) => {
    if (userVoti.includes(id)) {
      toast({ title: "Voto già registrato", description: "Hai già votato questa opinione." });
      return;
    }
    setIsVoting(true);
    try {
      const ref = doc(db, "opinioni_proposte", id);
      await updateDoc(ref, {
        votanti: arrayUnion(user.uid),
        voti: increment(1),
      });
      toast({ title: "Voto registrato", description: "Hai votato questa opinione." });
      loadData();
    } catch (error) {
      toast({ title: "Errore", description: "Errore nel voto", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-fuchsia-500 to-fuchsia-700 rounded-full"><MessageSquare className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-fuchsia-600 to-fuchsia-800 bg-clip-text text-transparent">Proponi Opinione</CardTitle>
            <CardDescription className="text-lg">Proponi nuove opinioni per Demos. L'admin valuterà le proposte più votate.</CardDescription>
          </CardHeader>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><MessageSquare className="h-5 w-5" /><span>Proponi una nuova opinione</span></CardTitle>
                <CardDescription>Inserisci il testo della nuova opinione che vorresti proporre.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProponi} className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Testo della nuova opinione..."
                      value={testoInput}
                      onChange={e => setTestoInput(e.target.value)}
                      disabled={submitting}
                    />
                    <Button type="submit" disabled={submitting || !testoInput.trim()} className="bg-fuchsia-600 hover:bg-fuchsia-700">
                      <Plus className="h-4 w-4 mr-1" /> Proponi
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><ThumbsUp className="h-5 w-5" /><span>Opinioni proposte</span></CardTitle>
                <CardDescription>Vota le opinioni che ritieni più importanti. L'admin valuterà le più votate.</CardDescription>
              </CardHeader>
              <CardContent>
                {opinioni.length === 0 ? (
                  <div className="text-center text-muted-foreground">Nessuna opinione proposta al momento.</div>
                ) : (
                  <ul className="space-y-4">
                    {opinioni.map(op => (
                      <li key={op.id} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <span className="font-medium">{op.testo}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-fuchsia-700 font-bold">{op.voti}</span>
                          <Button size="sm" variant="outline" disabled={isVoting || userVoti.includes(op.id)} onClick={() => handleVota(op.id)}>
                            <ThumbsUp className="h-4 w-4 mr-1" /> Vota
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 
