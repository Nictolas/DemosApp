import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Trash2, Plus, Edit, MessageSquare, Check, X } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Opinione {
  id: string;
  text: string;
}

interface OpinioneProposta {
  id: string;
  testo: string;
  voti: number;
}

export default function GestisciOpinioni() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [newId, setNewId] = useState("");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // 1. Caricamento opinioni ufficiali con React Query
  const { data: opinioniResponse, isLoading, isError: isOpinioniError } = useQuery<Opinione[]>({
    queryKey: ['opinioni'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/opinioni');
      if (!response.ok) throw new Error('Failed to fetch opinioni');
      return response.json();
    }
  });

  // 2. Caricamento opinioni proposte con React Query
  const { data: proposteResponse, isLoading: isLoadingProposte, isError: isProposteError } = useQuery<OpinioneProposta[]>({
    queryKey: ['opinioniProposte'],
    queryFn: async () => {
        const response = await apiRequest('GET', '/api/opinioni-proposte');
        if (!response.ok) throw new Error('Failed to fetch proposte');
        return response.json();
    }
  });

  // Estrai i dati con fallback sicuro e logging per debug
  const opinioni = opinioniResponse?.data || opinioniResponse || [];
  const proposte = proposteResponse || [];
  
  // Debug logging
  console.log('🔍 DEBUG GestisciOpinioni:', {
    opinioniResponse,
    opinioni: Array.isArray(opinioni) ? `${opinioni.length} opinioni` : `Non array: ${typeof opinioni}`,
    proposteResponse,
    proposte: Array.isArray(proposte) ? `${proposte.length} proposte` : `Non array: ${typeof proposte}`
  });

  // Funzione helper per invalidare e ricaricare tutte le query
  const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['opinioni'] });
      queryClient.invalidateQueries({ queryKey: ['opinioniProposte'] });
  };
  
  // 3. Mutazioni per le opinioni ufficiali
  const addMutation = useMutation({
    mutationFn: (newData: { id: string; text: string }) => apiRequest('POST', '/api/opinioni', newData),
    onSuccess: () => { toast({ title: "Successo", description: "Opinione aggiunta." }); setNewId(""); setNewText(""); invalidateAll(); },
    onError: () => toast({ title: "Errore", description: "Impossibile aggiungere l'opinione.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/opinioni/${id}`),
    onSuccess: () => { toast({ title: "Successo", description: "Opinione eliminata." }); invalidateAll(); },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare l'opinione.", variant: "destructive" }),
  });
  
  const editMutation = useMutation({
    mutationFn: (updatedData: { id: string; text: string }) => apiRequest('PUT', `/api/opinioni/${updatedData.id}`, { text: updatedData.text }),
    onSuccess: () => { toast({ title: "Successo", description: "Opinione aggiornata." }); setEditingId(null); setEditText(""); invalidateAll(); },
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare l'opinione.", variant: "destructive" }),
  });

  // 4. Mutazioni per le opinioni proposte
  const processPropostaMutation = useMutation({
      mutationFn: ({ id, action }: { id: string; action: 'accetta' | 'rifiuta' }) => {
          const url = action === 'accetta' ? `/api/opinioni-proposte/${id}/accetta` : `/api/opinioni-proposte/${id}`;
          const method = action === 'accetta' ? 'POST' : 'DELETE';
          return apiRequest(method, url);
      },
      onSuccess: (_, {action}) => { toast({ title: "Successo", description: `Proposta ${action === 'accetta' ? 'accettata' : 'rifiutata'}.` }); invalidateAll(); },
      onError: () => toast({ title: "Errore", description: "Impossibile processare la proposta.", variant: "destructive" }),
  });


  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newText.trim()) return;
    addMutation.mutate({ id: newId.trim(), text: newText.trim() });
  };

  const handleDelete = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa opinione? Verrà rimossa da tutto il sistema.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditSave = () => {
    if (!editingId || !editText.trim()) return;
    editMutation.mutate({ id: editingId, text: editText.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => setLocation("/gestisci")}> <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci </Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Gestisci Opinioni</CardTitle>
            <CardDescription>Aggiungi, modifica o elimina le opinioni ufficiali e gestisci le proposte degli utenti.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Sezione Proposte */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2"><MessageSquare className="h-5 w-5 text-fuchsia-600" /><span className="font-semibold">Opinioni proposte dagli utenti</span></div>
              {isLoadingProposte ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento...</div>
              : isProposteError ? <div className="text-red-500 text-sm">Errore nel caricamento delle proposte.</div>
              : !Array.isArray(proposte) ? <div className="text-red-500 text-sm">Errore nel caricamento delle proposte.</div>
              : proposte.length === 0 ? <div className="text-muted-foreground text-sm">Nessuna opinione proposta in attesa.</div>
              : (
                <ul className="space-y-2">
                  {proposte.map((op) => (
                    <li key={op.id} className="flex items-center justify-between border rounded px-3 py-2 bg-fuchsia-50">
                      <div className="flex flex-col">
                        <span className="font-medium">{op.testo}</span>
                        <span className="text-xs text-muted-foreground">Voti: {op.voti}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => processPropostaMutation.mutate({id: op.id, action: 'accetta'})} disabled={processPropostaMutation.isPending}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => processPropostaMutation.mutate({id: op.id, action: 'rifiuta'})} disabled={processPropostaMutation.isPending}><X className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Sezione Opinioni Ufficiali */}
            {isLoading ? <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            : isOpinioniError ? <div className="text-center text-red-500 py-8">Errore nel caricamento delle opinioni.</div>
            : (
              <>
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-2 mb-6 items-center">
                  <Input placeholder="ID (es. caccia)" value={newId} onChange={e => setNewId(e.target.value)} className="max-w-xs" />
                  <Input placeholder="Testo (es. Caccia)" value={newText} onChange={e => setNewText(e.target.value)} className="flex-1" />
                  <Button type="submit" disabled={addMutation.isPending || !newId.trim() || !newText.trim()}>
                    {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Aggiungi
                  </Button>
                </form>
                <div className="space-y-2">
                  {Array.isArray(opinioni) && opinioni.length > 0 ? opinioni.map((op) => (
                    <div key={op.id} className="flex items-center justify-between border rounded-lg px-4 py-2 bg-white shadow-sm">
                        {editingId === op.id ? (
                            <Input value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 mr-2"/>
                        ) : (
                            <span className="font-medium">{op.text} <span className="text-xs text-muted-foreground">({op.id})</span></span>
                        )}
                      <div className="flex gap-2">
                        {editingId === op.id ? (
                          <>
                            <Button size="sm" onClick={handleEditSave} disabled={editMutation.isPending || !editText.trim()}>
                                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => {setEditingId(op.id); setEditText(op.text);}}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => handleDelete(op.id)}>
                              {deleteMutation.isPending && deleteMutation.variables === op.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-muted-foreground py-4">
                      {!Array.isArray(opinioni) ? 'Errore nel caricamento delle opinioni' : 'Nessuna opinione disponibile'}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}