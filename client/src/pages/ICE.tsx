import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, ExternalLink, Calendar, ArrowLeft, ClipboardList, Check, Hourglass, X as XIcon, Globe2, Pencil, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { useEffect } from "react";

const iceSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")),
});

type ICEFormData = z.infer<typeof iceSchema>;

const fetcher = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const response = await fetch(queryKey[0] as string);
  if (!response.ok) {
    throw new Error('La risposta della rete non era ok');
  }
  return response.json();
};

export default function ICE() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [updatingQuorum, setUpdatingQuorum] = useState<string | null>(null);
  const quorumOptions = [
    { value: 'ok', label: 'Raggiunto', icon: <Check className="text-green-600 inline" /> },
    { value: 'pending', label: 'In attesa', icon: <Hourglass className="text-yellow-500 inline" /> },
    { value: 'no', label: 'Non raggiunto', icon: <XIcon className="text-red-600 inline" /> },
  ];

  const form = useForm<ICEFormData>({
    resolver: zodResolver(iceSchema),
    defaultValues: {
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  const [editICE, setEditICE] = useState<any | null>(null);
  const editForm = useForm<ICEFormData>({
    resolver: zodResolver(iceSchema),
    defaultValues: {
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  const [listaICE, setListaICE] = useState<any[]>([]);
  const [isListaLoading, setIsListaLoading] = useState(false);
  const [listaError, setListaError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setIsListaLoading(true);
    getDocs(collection(db, "ice"))
      .then(snap => {
        const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListaICE(arr);
      })
      .catch(() => setListaError("Errore nel caricamento delle ICE"))
      .finally(() => setIsListaLoading(false));
  }, [user]);

  // Mutazione per inviare una nuova ICE
  const submitICE = useMutation({
    mutationFn: async (data: ICEFormData) => {
      const response = await fetch("/api/ice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'invio della ICE");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "ICE proposta",
        description: "La tua ICE è stata proposta con successo.",
      });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ice/lista"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const patchICE = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: ICEFormData }) => {
      const response = await fetch(`/api/ice/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nella modifica della ICE");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "ICE modificata", description: "La ICE è stata aggiornata." });
      setEditICE(null);
      queryClient.invalidateQueries({ queryKey: ["/api/ice/lista"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // PATCH quorum
  const patchQuorum = async (id: string, quorum: 'ok' | 'pending' | 'no') => {
    setUpdatingQuorum(id);
    try {
      const res = await fetch(`/api/ice/${id}/quorum`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quorum })
      });
      if (!res.ok) throw new Error('Errore aggiornamento quorum');
      queryClient.invalidateQueries({ queryKey: ["/api/ice/lista"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare quorum', variant: 'destructive' });
    } finally {
      setUpdatingQuorum(null);
    }
  };

  // Funzione per cancellare una ICE (solo admin)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteICE = async (id: string) => {
    if (!user || user.ruolo !== 'Admin') return;
    if (!window.confirm('Sei sicuro di voler cancellare questa ICE?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ice/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore nella cancellazione');
      toast({ title: 'ICE cancellata', description: 'La ICE è stata rimossa.' });
      queryClient.invalidateQueries({ queryKey: ["/api/ice/lista"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile cancellare la ICE', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  // Proponi nuova ICE direttamente su Firestore
  const onSubmit = async (data: ICEFormData) => {
    try {
      await addDoc(collection(db, "ice"), {
        ...data,
        quorum: "pending",
        data_creazione: new Date().toISOString(),
      });
      toast({ title: "ICE proposta", description: "La tua ICE è stata proposta con successo." });
      form.reset();
      setShowForm(false);
      // Ricarica la lista
      getDocs(collection(db, "ice")).then(snap => setListaICE(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    } catch (error) {
      toast({ title: "Errore", description: "Errore nell'invio della ICE", variant: "destructive" });
    }
  };

  const openEdit = (ice: any) => {
    setEditICE(ice);
    editForm.reset({
      nome: ice.nome || "",
      descrizione: ice.descrizione || "",
      dataInizio: ice.dataInizio || "",
      dataFine: ice.dataFine || "",
      sitoWeb: ice.sitoWeb || "",
    });
  };

  // Modifica ICE direttamente su Firestore
  const onEditSubmit = async (data: ICEFormData) => {
    if (!editICE) return;
    try {
      await updateDoc(doc(db, "ice", editICE.id), data);
      toast({ title: "ICE modificata", description: "La ICE è stata aggiornata." });
      setEditICE(null);
      getDocs(collection(db, "ice")).then(snap => setListaICE(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    } catch (error) {
      toast({ title: "Errore", description: "Errore nella modifica della ICE", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-cyan-500 to-blue-700 rounded-full"><Globe2 className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-800 bg-clip-text text-transparent">ICE - Iniziative dei Cittadini Europei</CardTitle>
            <CardDescription>Proponi o consulta le ICE. Le 10 più recenti sono mostrate di seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => setShowForm(!showForm)} className="mb-4" variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />
                {showForm ? "Annulla" : "Proponi Nuova ICE"}
              </Button>
            </div>

            {showForm && (
              <Card>
                <CardHeader><CardTitle>Proponi Nuova ICE</CardTitle></CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="nome" render={({ field }) => (<FormItem><FormLabel>Nome della ICE</FormLabel><FormControl><Input placeholder="Es: ICE per l'ambiente" {...field} disabled={submitICE.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="descrizione" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Input placeholder="Descrizione della ICE" {...field} disabled={submitICE.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="dataInizio" render={({ field }) => (<FormItem><FormLabel>Data di inizio</FormLabel><FormControl><Input type="date" {...field} disabled={submitICE.isPending} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="dataFine" render={({ field }) => (<FormItem><FormLabel>Data di fine</FormLabel><FormControl><Input type="date" {...field} disabled={submitICE.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="sitoWeb" render={({ field }) => (<FormItem><FormLabel>Sito web (opzionale)</FormLabel><FormControl><Input placeholder="https://esempio.com" {...field} disabled={submitICE.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={submitICE.isPending}>{submitICE.isPending ? "Invio in corso..." : "Proponi ICE"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Ultime ICE Proposte</CardTitle><CardDescription>Le ICE più recenti proposte dalla comunità</CardDescription></CardHeader>
              <CardContent>
                {isListaLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <>
                    {listaError && <div className="text-center text-red-500 p-4">{listaError}</div>}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead>Data Inizio</TableHead>
                            <TableHead>Data Fine</TableHead>
                            <TableHead>Quorum</TableHead>
                            {user?.ruolo === 'Admin' && <TableHead>Azioni</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {listaICE.map((ice: any) => (
                            <TableRow key={ice.id}>
                              <TableCell className="font-medium">
                                {ice.sitoWeb ? (
                                  <a href={ice.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                    {ice.nome} <ExternalLink className="h-4 w-4 inline" />
                                  </a>
                                ) : (
                                  ice.nome
                                )}
                              </TableCell>
                              <TableCell>{ice.descrizione}</TableCell>
                              <TableCell>{ice.dataInizio}</TableCell>
                              <TableCell>{ice.dataFine}</TableCell>
                              <TableCell>
                                {user?.ruolo === 'Admin' ? (
                                  <select
                                    className="border rounded px-2 py-1"
                                    value={ice.quorum || 'pending'}
                                    disabled={updatingQuorum === ice.id}
                                    onChange={e => patchQuorum(ice.id, e.target.value as 'ok' | 'pending' | 'no')}
                                  >
                                    {quorumOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    {quorumOptions.find(opt => opt.value === (ice.quorum || 'pending'))?.icon}
                                    {quorumOptions.find(opt => opt.value === (ice.quorum || 'pending'))?.label}
                                  </span>
                                )}
                              </TableCell>
                              {user?.ruolo === 'Admin' && (
                                <TableCell>
                                  <Button size="sm" variant="outline" className="mr-2" onClick={() => openEdit(ice)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" disabled={deletingId === ice.id} onClick={() => deleteICE(ice.id)}>
                                    {deletingId === ice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editICE} onOpenChange={open => { if (!open) setEditICE(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica ICE</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="nome" render={({ field }) => (<FormItem><FormLabel>Nome della ICE</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="descrizione" render={({ field }) => (<FormItem><FormLabel>Descrizione</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={editForm.control} name="dataInizio" render={({ field }) => (<FormItem><FormLabel>Data di inizio</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="dataFine" render={({ field }) => (<FormItem><FormLabel>Data di fine</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={editForm.control} name="sitoWeb" render={({ field }) => (<FormItem><FormLabel>Sito web (opzionale)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={patchICE.isPending}>{patchICE.isPending ? "Salvataggio..." : "Salva modifiche"}</Button>
                <Button type="button" variant="ghost" onClick={() => setEditICE(null)}>Annulla</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 