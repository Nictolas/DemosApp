import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
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

  // Carica opinioni proposte e voti utente
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [opinioniRes, votiRes] = await Promise.all([
        fetch('/api/opinioni-proposte'),
        fetch('/api/opinioni-proposte/voti')
      ]);
      if (opinioniRes.ok) setOpinioni(await opinioniRes.json());
      if (votiRes.ok) setUserVoti(await votiRes.json());
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Proponi nuova opinione
  const handleProponi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testoInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/opinioni-proposte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testoInput.trim() })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast({ title: "Opinione proposta!", description: "La tua proposta sarà valutata dall'admin." });
        setTestoInput("");
        loadData();
      } else {
        toast({ title: "Errore", description: result.error || "Errore nell'invio della proposta", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Vota opinione
  const handleVota = async (id: string) => {
    if (userVoti.includes(id)) {
      toast({ title: "Voto già registrato", description: "Hai già votato questa opinione." });
      return;
    }
    setIsVoting(true);
    try {
      const res = await fetch('/api/opinioni-proposte/vota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast({ title: "Voto registrato", description: "Hai votato questa opinione." });
        loadData();
      } else {
        const result = await res.json();
        toast({ title: "Errore", description: result.error || "Errore nel voto", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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