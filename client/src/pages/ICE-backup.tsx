import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, ExternalLink, ArrowLeft, Globe2, Pencil, Trash2, Check, Hourglass, X as XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

const iceSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")).optional(),
});
type ICEFormData = z.infer<typeof iceSchema>;

interface ICE {
  id: string;
  nome: string;
  descrizione: string;
  quorum: string;
  sitoWeb?: string;
  dataInizio?: string;
  dataFine?: string;
  data_creazione: string;
  votiIces?: number;
}

export default function ICE() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [editICE, setEditICE] = useState<ICE | null>(null);

  const form = useForm<ICEFormData>({ resolver: zodResolver(iceSchema), defaultValues: { nome: "", descrizione: "", dataInizio: "", dataFine: "", sitoWeb: "" }});
  const editForm = useForm<ICEFormData>({ resolver: zodResolver(iceSchema) });

  // 1. Caricamento dati con React Query
  const { data: iceData, isLoading, isError } = useQuery<{success: boolean, richieste: ICE[], mieiVoti: string[], blocco: any}>({
    queryKey: ['iceList'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ice");
      if (!response.ok) throw new Error("Errore nel caricamento delle ICE");
      return response.json();
    },
    enabled: !!user,
  });

  // Estrai la lista ICE dai dati ricevuti
  const listaICE = iceData?.richieste || [];
  const mieiVoti = iceData?.mieiVoti || [];

  // Funzione helper per ricaricare i dati
  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: ['iceList'] });

  // 2. Mutazioni gestite da React Query
  const addMutation = useMutation({
    mutationFn: (data: ICEFormData) => apiRequest("POST", "/api/ice", data),
    onSuccess: () => {
      toast({ title: "ICE proposta", description: "La tua proposta è stata inviata con successo." });
      form.reset();
      setShowForm(false);
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile proporre l'ICE.", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: ICEFormData) => apiRequest("PUT", `/api/ice/${editICE?.id}`, data),
    onSuccess: () => {
      toast({ title: "ICE modificata", description: "L'ICE è stata aggiornata." });
      setEditICE(null);
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile aggiornare l'ICE.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ice/${id}`),
    onSuccess: () => {
      toast({ title: "ICE cancellata", description: "L'ICE è stata rimossa." });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile cancellare l'ICE.", variant: "destructive" }),
  });
  



  const openEditDialog = (ice: ICE) => {
    setEditICE(ice);
    editForm.reset(ice);
  };
  
  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Caricamento...</span></div>;
  if (!user) return <Redirect to="/auth" />;



  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 page-with-navbar">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-cyan-500 to-blue-700 rounded-full"><Globe2 className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold">ICE - Iniziative dei Cittadini Europei</CardTitle>
            <CardDescription>Proponi o consulta le ICE. Le più recenti sono mostrate di seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />{showForm ? "Annulla" : "Proponi Nuova ICE"}
              </Button>
            </div>

            {showForm && (
              <Card><CardHeader><CardTitle>Modulo Nuova ICE</CardTitle></CardHeader><CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                    {/* ... form fields ... */}
                    <Button type="submit" className="w-full" disabled={addMutation.isPending}>{addMutation.isPending ? "Invio in corso..." : "Proponi ICE"}</Button>
                  </form>
                </Form>
              </CardContent></Card>
            )}

            <Card>
              <CardHeader><CardTitle>Iniziative dei Cittadini Europei (ICE)</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /><span className="ml-2">Caricamento ICE...</span></div>
                : isError ? <div className="text-center text-red-500 p-4">Errore nel caricamento delle ICE. Riprova più tardi.</div>
                : (
                  <div className="overflow-x-auto">
                                         <Table>
                       <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrizione</TableHead><TableHead>Quorum</TableHead><TableHead>Periodo</TableHead><TableHead>Voti</TableHead>{user.ruolo === 'Admin' && <TableHead className="text-right">Azioni</TableHead>}</TableRow></TableHeader>
                      <TableBody>
                        {listaICE.map((ice) => (
                          <TableRow key={ice.id}>
                                                         <TableCell className="font-medium">
                               {ice.sitoWeb ? <a href={ice.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">{ice.nome} <ExternalLink className="h-4 w-4" /></a> : ice.nome}
                             </TableCell>
                             <TableCell className="max-w-xs truncate" title={ice.descrizione}>
                               {ice.descrizione?.substring(0, 100)}...
                             </TableCell>
                             <TableCell>
                               <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                 ice.quorum === 'ok' ? 'bg-green-100 text-green-800' :
                                 ice.quorum === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                 'bg-red-100 text-red-800'
                               }`}>
                                 {ice.quorum === 'ok' ? 'Raggiunto' : 
                                  ice.quorum === 'pending' ? 'In attesa' : 
                                  ice.quorum}
                               </span>
                             </TableCell>
                             <TableCell>
                               {ice.dataInizio && ice.dataFine ? 
                                 `${new Date(ice.dataInizio).toLocaleDateString('it-IT')} - ${new Date(ice.dataFine).toLocaleDateString('it-IT')}` :
                                 'N/A'
                               }
                             </TableCell>
                             <TableCell>
                               {ice.votiIces || 0}
                             </TableCell>
                            {user.ruolo === 'Admin' && (
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" className="mr-2" onClick={() => openEditDialog(ice)} title="Modifica ICE"><Pencil className="h-4 w-4" /></Button>
                                <Button size="sm" variant="destructive" disabled={deleteMutation.isPending && deleteMutation.variables === ice.id} onClick={() => deleteMutation.mutate(ice.id)} title="Elimina ICE">
                                    {deleteMutation.isPending && deleteMutation.variables === ice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {listaICE.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        Nessuna ICE disponibile al momento.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editICE} onOpenChange={open => !open && setEditICE(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica ICE</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editMutation.mutate(data))} className="space-y-4 pt-4">
              {/* ... form fields for editing ... */}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditICE(null)}>Annulla</Button>
                <Button type="submit" disabled={editMutation.isPending}>{editMutation.isPending ? "Salvataggio in corso..." : "Salva Modifiche"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
