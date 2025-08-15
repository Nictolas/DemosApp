// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsUp, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase-stub";
import { collection, getDocs, addDoc, deleteDoc, query, where, doc, updateDoc } from "firebase/firestore";

export default function VotaIniziativaPopolare() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [iniziative, setIniziative] = useState<any[]>([]);
  const [voti, setVoti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [userVoti, setUserVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [showClassifica, setShowClassifica] = useState(false);
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoTimer, setVideoTimer] = useState(60);

  // Carica iniziative e voti
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    async function fetchData() {
      const snapIniz = await getDocs(collection(db, "iniziative_popolari"));
      const tutteIniz = snapIniz.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const quorumOk = tutteIniz.filter(i => i.quorum === "ok");
      const snapVoti = await getDocs(collection(db, "voti_iniziative_popolari"));
      const tuttiVoti = snapVoti.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIniziative(quorumOk);
      setVoti(tuttiVoti);
      // Voti utente
      const mieiVoti = tuttiVoti.filter(v => v.userId === user.uid).map(v => v.iniziativaId);
      setUserVoti(mieiVoti);
      setSelectedVoti(mieiVoti);
      setLoading(false);
    }
    fetchData();
  }, [user]);

  // Blocco settimanale
  useEffect(() => {
    if (!user) return;
    if (user.ruolo === "Admin") {
      setIsBlocked(false);
      setUnlockDate(null);
      return;
    }
    const lastEdit = user.lastVotoIniziativaEdit ? new Date(user.lastVotoIniziativaEdit) : null;
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
        await addDoc(collection(db, "voti_iniziative_popolari"), {
          iniziativaId: id,
          userId: user.uid,
          timestamp: new Date().toISOString()
        });
      }
      // Rimuovi voti tolti
      for (const id of daRimuovere) {
        const q = query(collection(db, "voti_iniziative_popolari"), where("userId", "==", user.uid), where("iniziativaId", "==", id));
        const snap = await getDocs(q);
        for (const docu of snap.docs) {
          await deleteDoc(docu.ref);
        }
      }
      // Aggiorna lastVotoIniziativaEdit
      const userDocRef = doc(db, "utenti", user.uid);
      await updateDoc(userDocRef, { lastVotoIniziativaEdit: new Date().toISOString() });
      toast({ title: "Preferenze salvate", description: "Le tue preferenze sono state aggiornate." });
      // Ricarica voti
      const snapVoti = await getDocs(collection(db, "voti_iniziative_popolari"));
      setVoti(snapVoti.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setUserVoti([...selectedVoti]);
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

  if (isLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Conta i voti per ogni iniziativa
  const votiPerIniziativa: Record<string, number> = {};
  voti.forEach(v => {
    if (v.iniziativaId) votiPerIniziativa[v.iniziativaId] = (votiPerIniziativa[v.iniziativaId] || 0) + 1;
  });

  // Ordina per più votate
  const iniziativeOrdinate = [...iniziative].sort((a, b) => (votiPerIniziativa[b.id] || 0) - (votiPerIniziativa[a.id] || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800" style={{ paddingBottom: '80px' }}>
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Iniziative Popolari con Quorum Raggiunto</CardTitle>
            <CardDescription>Vota le iniziative popolari che hanno raggiunto il quorum. Le più votate sono in cima.</CardDescription>
          </CardHeader>
          <CardContent>
            {isBlocked && (
              <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
                <b>Hai già modificato le preferenze questa settimana.</b><br />
                Potrai modificarle di nuovo dal: {unlockDate ? unlockDate.toLocaleString() : "-"}
              </div>
            )}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Le tue preferenze:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedVoti.map((id, index) => {
                  const iniziativa = iniziative.find(i => i.id === id);
                  return iniziativa ? (
                    <span key={id} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      <X className="h-3 w-3 mr-1 cursor-pointer" onClick={() => setSelectedVoti(prev => prev.filter(n => n !== id))} />
                      {iniziativa.nome}
                    </span>
                  ) : null;
                })}
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleSalvaVoti} disabled={isVoting || JSON.stringify(selectedVoti.sort()) === JSON.stringify(userVoti.sort()) || isBlocked}>
                  {isVoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salva
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Voti</TableHead>
                  <TableHead>Seleziona</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iniziativeOrdinate.map((iniziativa: any) => {
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
                      <TableCell>{votiPerIniziativa[iniziativa.id] || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={selezionato ? "default" : "outline"}
                          onClick={() => toggleSelezione(iniziativa.id)}
                          disabled={isVoting || isBlocked}
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" /> {selezionato ? "Selezionato" : "Seleziona"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {iniziativeOrdinate.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">Nessuna iniziativa ha raggiunto il quorum.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {/* PUBBLICITÀ E CLASSIFICA */}
            <div className="mt-8">
              {!showClassifica ? (
                <div className="flex flex-col items-center space-y-4">
                  {showVideo ? (
                    <div className="flex flex-col items-center">
                      <div className="mb-2 font-semibold">Pubblicità video in corso...<br />Attendi {videoTimer} secondi</div>
                      <video width="320" height="180" controls autoPlay muted style={{ marginBottom: 12 }}>
                        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
                        Il tuo browser non supporta il video.
                      </video>
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </div>
                  ) : (
                    <Button onClick={handleShowClassifica} className="w-full max-w-xs">Mostra classifica</Button>
                  )}
                  {/* Dialog di conferma pubblicità */}
                  {showAdDialog && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
                      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                        <h2 className="text-lg font-bold mb-2">Vuoi vedere la classifica?</h2>
                        <p className="mb-4">Per vedere la classifica dovrai guardare 60 secondi di pubblicità video.</p>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowAdDialog(false)}>Annulla</Button>
                          <Button onClick={handleApproveAd}>Approva</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold mb-2">Classifica Top 10</h4>
                  {iniziativeOrdinate.slice(0, 10).map((iniziativa, index) => (
                    <div key={iniziativa.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>#{index + 1}</div>
                        <span className="font-medium">{iniziativa.nome}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{votiPerIniziativa[iniziativa.id] || 0} voti</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Dialog di conferma salvataggio */}
            {showConfirmDialog && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                  <h2 className="text-lg font-bold mb-2">Conferma salvataggio preferenze</h2>
                  <p className="mb-4">Dopo aver salvato, potrai modificare le preferenze solo tra una settimana. Confermi?</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Annulla</Button>
                    <Button onClick={handleConfermaSalva} disabled={isVoting}>Conferma</Button>
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