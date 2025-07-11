// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsUp } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, query, where } from "firebase/firestore";

export default function VotaIniziativaPopolare() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [iniziative, setIniziative] = useState<any[]>([]);
  const [voti, setVoti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  // Carica iniziative con quorum ok
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    async function fetchData() {
      // Iniziative con quorum ok
      const snapIniz = await getDocs(collection(db, "iniziative_popolari"));
      const tutteIniz = snapIniz.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const quorumOk = tutteIniz.filter(i => i.quorum === "ok");
      // Voti
      const snapVoti = await getDocs(collection(db, "voti_iniziative_popolari"));
      const tuttiVoti = snapVoti.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIniziative(quorumOk);
      setVoti(tuttiVoti);
      setLoading(false);
    }
    fetchData();
  }, [user]);

  // Funzione per votare
  const handleVote = async (iniziativaId: string) => {
    if (!user) return;
    setIsVoting(true);
    try {
      // Controlla se già votato
      const haVotato = voti.some(v => v.userId === user.uid && v.iniziativaId === iniziativaId);
      if (haVotato) return;
      await addDoc(collection(db, "voti_iniziative_popolari"), {
        iniziativaId,
        userId: user.uid,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Voto registrato", description: "Il tuo voto è stato registrato con successo." });
      // Ricarica voti
      const snapVoti = await getDocs(collection(db, "voti_iniziative_popolari"));
      setVoti(snapVoti.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  // Funzione per rimuovere il voto
  const handleRemoveVote = async (iniziativaId: string) => {
    if (!user) return;
    setIsVoting(true);
    try {
      const q = query(collection(db, "voti_iniziative_popolari"), where("userId", "==", user.uid), where("iniziativaId", "==", iniziativaId));
      const snap = await getDocs(q);
      for (const docu of snap.docs) {
        await deleteDoc(docu.ref);
      }
      toast({ title: "Voto rimosso", description: "Hai rimosso il tuo voto." });
      // Ricarica voti
      const snapVoti = await getDocs(collection(db, "voti_iniziative_popolari"));
      setVoti(snapVoti.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Iniziative Popolari con Quorum Raggiunto</CardTitle>
            <CardDescription>Vota le iniziative popolari che hanno raggiunto il quorum. Le più votate sono in cima.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Voti</TableHead>
                  <TableHead>Vota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iniziativeOrdinate.map((iniziativa: any) => {
                  const haVotato = voti.some(v => v.userId === user.uid && v.iniziativaId === iniziativa.id);
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
                        {haVotato ? (
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveVote(iniziativa.id)} disabled={isVoting}>
                            Rimuovi voto
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => handleVote(iniziativa.id)}
                            disabled={isVoting}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" /> Vota
                          </Button>
                        )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 