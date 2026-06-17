import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { Loader2, Plus, ExternalLink, ArrowLeft, Vote, Pencil, Trash2, Check, Hourglass, X as XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

const referendumSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  descrizione: z.string().min(1, "La descrizione è obbligatoria"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")).optional(),
});
type ReferendumFormData = z.infer<typeof referendumSchema>;

interface Referendum extends ReferendumFormData {
  id: string;
  quorum: 'ok' | 'pending' | 'no';
}

export default function ReferendumAbrogativi() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editReferendum, setEditReferendum] = useState<Referendum | null>(null);

  const form = useForm<ReferendumFormData>({ resolver: zodResolver(referendumSchema), defaultValues: { nome: "", descrizione: "", dataInizio: "", dataFine: "", sitoWeb: "" }});
  const editForm = useForm<ReferendumFormData>({ resolver: zodResolver(referendumSchema) });

  // 1. Caricamento dati con React Query
  const { data: listaReferendum = [], isLoading, isError } = useQuery<Referendum[]>({
    queryKey: ['referendumList'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      if (!response.ok) throw new Error("Errore nel caricamento dei referendum");
      return response.json();
    },
    enabled: !!user,
  });

  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: ['referendumList'] });

  // 2. Mutazioni gestite da React Query
  const addMutation = useMutation({
    mutationFn: (data: ReferendumFormData) => apiRequest("POST", "/api/referendum-abrogativi", data),
    onSuccess: () => { toast({ title: "Referendum proposto", description: "La tua proposta è stata inviata." }); form.reset(); setShowForm(false); invalidateAndRefetch(); },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile proporre il referendum.", variant: "destructive" }),
  });

  const editMutation = useMutation({
      mutationFn: (data: ReferendumFormData) => apiRequest("PUT", `/api/referendum-abrogativi/${editReferendum?.id}`, data),
      onSuccess: () => { toast({ title: "Referendum modificato" }); setEditReferendum(null); invalidateAndRefetch(); },
      onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile aggiornare il referendum.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/referendum-abrogativi/${id}`),
    onSuccess: () => { toast({ title: "Referendum cancellato" }); invalidateAndRefetch(); },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile cancellare il referendum.", variant: "destructive" }),
  });
  
  const quorumMutation = useMutation({
      mutationFn: ({ id, quorum }: { id: string, quorum: 'ok' | 'pending' | 'no' }) => apiRequest("PATCH", `/api/referendum-abrogativi/${id}/quorum`, { quorum }),
      onSuccess: () => { toast({ title: "Quorum aggiornato" }); invalidateAndRefetch(); },
      onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile aggiornare il quorum.", variant: "destructive" }),
  });

  const openEditDialog = (referendum: Referendum) => {
    setEditReferendum(referendum);
    editForm.reset(referendum);
  };

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  const quorumOptions = [
    { value: 'ok', label: 'Raggiunto', icon: <Check className="text-green-600 inline" /> },
    { value: 'pending', label: 'In attesa', icon: <Hourglass className="text-yellow-500 inline" /> },
    { value: 'no', label: 'Non raggiunto', icon: <XIcon className="text-red-600 inline" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl space-y-6">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl"><Vote className="h-6 w-6" />Referendum Abrogativi</CardTitle>
            <CardDescription>Proponi e gestisci i referendum abrogativi.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-4">
              <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />{showForm ? "Annulla" : "Proponi Referendum"}
              </Button>
            </div>

            {showForm && (
                <Card><CardHeader><CardTitle>Proponi Nuovo Referendum</CardTitle></CardHeader><CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                            {/* ... form fields for adding ... */}
                            <Button type="submit" className="w-full" disabled={addMutation.isPending}>{addMutation.isPending ? "Invio..." : "Invia Proposta"}</Button>
                        </form>
                    </Form>
                </CardContent></Card>
            )}

            <Card>
                <CardHeader><CardTitle>Lista Referendum</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    : isError ? <div className="text-center text-red-500 p-4">Errore nel caricamento.</div>
                    : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Periodo</TableHead><TableHead>Quorum</TableHead>{user.ruolo === "AD" && <TableHead className="text-right">Azioni</TableHead>}</TableRow></TableHeader>
                                <TableBody>
                                    {listaReferendum.length === 0 ? <TableRow><TableCell colSpan={user.ruolo === "AD" ? 4 : 3} className="text-center text-gray-500">Nessun referendum presente.</TableCell></TableRow>
                                    : listaReferendum.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-medium">{r.sitoWeb ? <a href={r.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{r.nome}</a> : r.nome}</TableCell>
                                            <TableCell>{new Date(r.dataInizio).toLocaleDateString('it-IT')} - {new Date(r.dataFine).toLocaleDateString('it-IT')}</TableCell>
                                            <TableCell>
                                                {user.ruolo === "AD" ? (
                                                    <select className="border rounded px-2 py-1 bg-white" value={r.quorum} disabled={quorumMutation.isPending} onChange={e => quorumMutation.mutate({id: r.id, quorum: e.target.value as any})}>
                                                        {quorumOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="flex items-center gap-1">{quorumOptions.find(opt => opt.value === r.quorum)?.icon} {quorumOptions.find(opt => opt.value === r.quorum)?.label}</span>
                                                )}
                                            </TableCell>
                                            {user.ruolo === "AD" && (
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="outline" className="mr-2" onClick={() => openEditDialog(r)}><Pencil className="h-4 w-4" /></Button>
                                                    <Button size="sm" variant="destructive" disabled={deleteMutation.isPending && deleteMutation.variables === r.id} onClick={() => deleteMutation.mutate(r.id)}>
                                                        {deleteMutation.isPending && deleteMutation.variables === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Dialog open={!!editReferendum} onOpenChange={open => !open && setEditReferendum(null)}>
            <DialogContent>
                <DialogHeader><DialogTitle>Modifica Referendum</DialogTitle></DialogHeader>
                <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit((data) => editMutation.mutate(data))} className="space-y-4 pt-4">
                        {/* ... form fields for editing ... */}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setEditReferendum(null)}>Annulla</Button>
                            <Button type="submit" disabled={editMutation.isPending}>{editMutation.isPending ? "Salvataggio..." : "Salva Modifiche"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
