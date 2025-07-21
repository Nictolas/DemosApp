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
import { Loader2, Plus, ExternalLink, Calendar, ArrowLeft, ClipboardList, Check, Hourglass, X as XIcon, Vote, Pencil, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useEffect } from "react";

const referendumSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")),
});

type ReferendumFormData = z.infer<typeof referendumSchema>;

const fetcher = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const response = await fetch(queryKey[0] as string);
  if (!response.ok) {
    throw new Error('La risposta della rete non era ok');
  }
  return response.json();
};

export default function ReferendumAbrogativi() {
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

  const form = useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema),
    defaultValues: {
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  const [editReferendum, setEditReferendum] = useState<any | null>(null);
  const editForm = useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema),
    defaultValues: {
      nome: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  const [listaReferendum, setListaReferendum] = useState<any[]>([]);
  const [isListaLoading, setIsListaLoading] = useState(false);
  const [listaError, setListaError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setIsListaLoading(true);
    getDocs(collection(db, "referendum_abrogativi"))
      .then(snap => {
        const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListaReferendum(arr);
      })
      .catch(() => setListaError("Errore nel caricamento dei referendum abrogativi"))
      .finally(() => setIsListaLoading(false));
  }, [user]);

  // Mutazione per inviare un nuovo referendum
  const submitReferendum = useMutation({
    mutationFn: async (data: ReferendumFormData) => {
      const response = await apiRequest("POST", "/api/referendum-abrogativi", data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Referendum proposto",
        description: "Il tuo referendum è stato proposto con successo.",
      });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/lista"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const patchReferendum = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: ReferendumFormData }) => {
      const response = await apiRequest("PATCH", `/api/referendum-abrogativi/${id}`, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response;
    },
    onSuccess: () => {
      toast({ title: "Referendum modificato", description: "Il referendum è stato aggiornato." });
      setEditReferendum(null);
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/lista"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // PATCH quorum
  const patchQuorum = async (id: string, quorum: 'ok' | 'pending' | 'no') => {
    setUpdatingQuorum(id);
    try {
      const res = await apiRequest("PATCH", `/api/referendum-abrogativi/${id}/quorum`, { quorum });
      if (res.error) throw new Error('Errore aggiornamento quorum');
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/lista"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare quorum', variant: 'destructive' });
    } finally {
      setUpdatingQuorum(null);
    }
  };

  // Funzione per cancellare un referendum (solo admin)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteReferendum = async (id: string) => {
    if (!user || user.ruolo !== 'Admin') return;
    if (!window.confirm('Sei sicuro di voler cancellare questo referendum?')) return;
    setDeletingId(id);
    try {
      const res = await apiRequest("DELETE", `/api/referendum-abrogativi/${id}`);
      if (res.error) throw new Error('Errore nella cancellazione');
      toast({ title: 'Referendum cancellato', description: 'Il referendum è stato rimosso.' });
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/lista"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile cancellare il referendum', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = (data: ReferendumFormData) => {
    submitReferendum.mutate(data);
  };

  const openEdit = (referendum: any) => {
    setEditReferendum(referendum);
    editForm.reset({
      nome: referendum.nome || "",
      descrizione: referendum.descrizione || "",
      dataInizio: referendum.dataInizio || "",
      dataFine: referendum.dataFine || "",
      sitoWeb: referendum.sitoWeb || "",
    });
  };

  const onEditSubmit = (data: ReferendumFormData) => {
    if (editReferendum) {
      patchReferendum.mutate({ id: editReferendum.id, data });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <Vote className="h-6 w-6" /> Referendum Abrogativi
            </CardTitle>
            <CardDescription>Proponi, modifica e gestisci i referendum abrogativi. Solo gli admin possono modificare o eliminare.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-4">
              <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />
                {showForm ? "Annulla" : "Proponi Referendum Abrogativo"}
              </Button>
            </div>
            {showForm && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-8">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome del referendum" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descrizione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrizione</FormLabel>
                        <FormControl>
                          <Input placeholder="Descrizione" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dataInizio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Inizio</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataFine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Fine</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="sitoWeb"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sito Web</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    Invia Referendum
                  </Button>
                </form>
              </Form>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Sito Web</TableHead>
                    <TableHead>Quorum</TableHead>
                    {user?.ruolo === 'Admin' && <TableHead>Azione</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaError && <div className="text-center text-red-500 p-4">{listaError}</div>}
                  {listaReferendum.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.sitoWeb ? (
                          <a href={r.sitoWeb} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-blue-600 hover:text-blue-800">
                            <span>{r.nome}</span>
                            <ExternalLink className="ml-1 h-4 w-4" />
                          </a>
                        ) : (
                          <span>{r.nome}</span>
                        )}
                      </TableCell>
                      <TableCell>{r.descrizione}</TableCell>
                      <TableCell>
                        <Calendar className="inline h-4 w-4 mr-1" />
                        {new Date(r.dataInizio).toLocaleDateString('it-IT')} - {new Date(r.dataFine).toLocaleDateString('it-IT')}
                      </TableCell>
                      <TableCell>
                        {r.sitoWeb ? (
                          <a href={r.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Visita</a>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user?.ruolo === 'Admin' ? (
                          <select
                            className="border rounded px-2 py-1"
                            value={r.quorum || 'pending'}
                            onChange={e => patchQuorum(r.id, e.target.value as 'ok' | 'pending' | 'no')}
                            disabled={updatingQuorum === r.id}
                          >
                            {quorumOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant={r.quorum === 'ok' ? 'success' : r.quorum === 'no' ? 'destructive' : 'default'}>
                            {quorumOptions.find(opt => opt.value === r.quorum)?.label || 'In attesa'}
                          </Badge>
                        )}
                      </TableCell>
                      {user?.ruolo === 'Admin' && (
                        <TableCell className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteReferendum(r.id)} disabled={deletingId === r.id}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {listaReferendum.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={user?.ruolo === 'Admin' ? 6 : 5} className="text-center text-gray-500">Nessun referendum abrogativo presente.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {/* Dialog per modifica referendum */}
        <Dialog open={!!editReferendum} onOpenChange={o => { if (!o) setEditReferendum(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica Referendum</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome del referendum" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="descrizione"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrizione</FormLabel>
                      <FormControl>
                        <Input placeholder="Descrizione" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="dataInizio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Inizio</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="dataFine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fine</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="sitoWeb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sito Web</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" className="w-full">Salva modifiche</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}