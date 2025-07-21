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
import { Loader2, Plus, ExternalLink, Calendar, ArrowLeft, ClipboardList, Check, Hourglass, X as XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useEffect } from "react";

const iniziativaSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")).optional(),
});

type IniziativaFormData = z.infer<typeof iniziativaSchema>;

// Funzione helper generica per le chiamate fetch
const fetcher = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const response = await fetch(queryKey[0] as string);
    if (!response.ok) {
        throw new Error('La risposta della rete non era ok');
    }
    return response.json();
};

export default function IniziativePopolare() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Stato quorum persistente
  const [updatingQuorum, setUpdatingQuorum] = useState<string | null>(null);
  const quorumOptions = [
    { value: 'ok', label: 'Raggiunto', icon: <Check className="text-green-600 inline" /> },
    { value: 'pending', label: 'In attesa', icon: <Hourglass className="text-yellow-500 inline" /> },
    { value: 'no', label: 'Non raggiunto', icon: <XIcon className="text-red-600 inline" /> },
  ];

  const form = useForm<IniziativaFormData>({
    resolver: zodResolver(iniziativaSchema),
    defaultValues: {
      nome: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  const [listaIniziative, setListaIniziative] = useState<any[]>([]);
  const [isListaLoading, setIsListaLoading] = useState(false);
  const [listaError, setListaError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setIsListaLoading(true);
    getDocs(collection(db, "iniziative_popolari"))
      .then(snap => {
        const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListaIniziative(arr);
      })
      .catch(() => setListaError("Errore nel caricamento delle iniziative popolari"))
      .finally(() => setIsListaLoading(false));
  }, [user]);

  // Mutazione per inviare una nuova iniziativa
  const submitInitiative = useMutation({
    mutationFn: async (data: IniziativaFormData) => {
      const response = await apiRequest("POST", "/api/iniziative-popolari", data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Iniziativa proposta",
        description: "La tua iniziativa è stata proposta con successo.",
      });
      form.reset();
      setShowForm(false);
      // Invalida la query per forzare il ricaricamento della lista
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/lista"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // PATCH quorum
  const patchQuorum = async (id: string, quorum: 'ok' | 'pending' | 'no') => {
    setUpdatingQuorum(id);
    try {
      const res = await apiRequest("PATCH", `/api/iniziative-popolari/${id}/quorum`, { quorum });
      if (res.error) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/lista"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare quorum', variant: 'destructive' });
    } finally {
      setUpdatingQuorum(null);
    }
  };

  // Funzione per cancellare un'iniziativa (solo admin)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteIniziativa = async (id: string) => {
    if (!user || user.ruolo !== 'Admin') return;
    if (!window.confirm('Sei sicuro di voler cancellare questa iniziativa?')) return;
    setDeletingId(id);
    try {
      const res = await apiRequest("DELETE", `/api/iniziative-popolari/${id}`);
      if (res.error) throw new Error(res.error);
      toast({ title: 'Iniziativa cancellata', description: 'L\'iniziativa è stata rimossa.' });
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/lista"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile cancellare l\'iniziativa', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = (data: IniziativaFormData) => {
    submitInitiative.mutate(data);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Iniziative Popolari</CardTitle>
            <CardDescription>Proponi o consulta le iniziative popolari. Le 10 più recenti sono mostrate di seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => setShowForm(!showForm)} className="mb-4" variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />
                {showForm ? "Annulla" : "Proponi Nuova Iniziativa"}
              </Button>
            </div>

            {showForm && (
              <Card>
                <CardHeader><CardTitle>Proponi Nuova Iniziativa</CardTitle></CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="nome" render={({ field }) => (<FormItem><FormLabel>Nome dell'iniziativa</FormLabel><FormControl><Input placeholder="Es: Iniziativa per l'ambiente" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="dataInizio" render={({ field }) => (<FormItem><FormLabel>Data di inizio</FormLabel><FormControl><Input type="date" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="dataFine" render={({ field }) => (<FormItem><FormLabel>Data di fine</FormLabel><FormControl><Input type="date" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="sitoWeb" render={({ field }) => (<FormItem><FormLabel>Sito web (opzionale)</FormLabel><FormControl><Input placeholder="https://esempio.com" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={submitInitiative.isPending}>{submitInitiative.isPending ? "Invio in corso..." : "Proponi Iniziativa"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Ultime Iniziative Proposte</CardTitle><CardDescription>Le iniziative più recenti proposte dalla comunità</CardDescription></CardHeader>
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
                            <TableHead>Data Inizio</TableHead>
                            <TableHead>Data Fine</TableHead>
                            <TableHead>Quorum</TableHead>
                            {user?.ruolo === 'Admin' && <TableHead>Azioni</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {listaIniziative.map((iniz: any) => (
                            <TableRow key={iniz.id}>
                              <TableCell className="font-medium">
                                {iniz.sitoWeb ? (
                                  <a href={iniz.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                    {iniz.nome} <ExternalLink className="h-4 w-4 inline" />
                                  </a>
                                ) : (
                                  iniz.nome
                                )}
                              </TableCell>
                              <TableCell>{iniz.dataInizio}</TableCell>
                              <TableCell>{iniz.dataFine}</TableCell>
                              <TableCell>
                                <div className="flex gap-2 items-center">
                                  {quorumOptions.map(opt => (
                                    <Button key={opt.value} size="sm" variant={iniz.quorum === opt.value ? "default" : "outline"} disabled={user?.ruolo !== 'Admin' || updatingQuorum === iniz.id} onClick={() => patchQuorum(iniz.id, opt.value as 'ok' | 'pending' | 'no')}>
                                      {opt.icon} {opt.label}
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                              {user?.ruolo === 'Admin' && (
                                <TableCell>
                                  <Button size="sm" variant="destructive" disabled={deletingId === iniz.id} onClick={() => deleteIniziativa(iniz.id)}>
                                    {deletingId === iniz.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XIcon className="h-4 w-4" />} Elimina
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {listaIniziative.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400"><ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nessuna iniziativa proposta al momento.</p></div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}