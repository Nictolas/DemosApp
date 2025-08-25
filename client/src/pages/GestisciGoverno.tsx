import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Plus, Pencil, Save, X as XIcon, ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Ministero {
  id: string;
  nome: string;
  categoria: string;
  descrizione?: string;
}

export default function GestisciGoverno() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [form, setForm] = useState({ nome: '', categoria: '', descrizione: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ nome: string; categoria: string; descrizione?: string }>({ nome: '', categoria: '', descrizione: '' });

  // 1. Caricamento dati con React Query
  const { data: ministeri = [], isLoading, isError } = useQuery<Ministero[]>({
    queryKey: ['ministeri'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ministeri");
      if (!response.ok) throw new Error("Errore nel caricamento dei ministeri");
      return response.json();
    }
  });

  // 2. Mutazione per Aggiungere un ministero
  const addMutation = useMutation({
    mutationFn: (newMinistero: Omit<Ministero, 'id'>) => apiRequest("POST", "/api/ministeri", newMinistero),
    onSuccess: () => {
      toast({ title: "Successo", description: "Ministero aggiunto." });
      queryClient.invalidateQueries({ queryKey: ['ministeri'] });
      setForm({ nome: '', categoria: '', descrizione: '' });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile aggiungere il ministero.", variant: "destructive" }),
  });

  // 3. Mutazione per Modificare un ministero
  const editMutation = useMutation({
    mutationFn: (updatedMinistero: Omit<Ministero, 'id'>) => apiRequest("PUT", `/api/ministeri/${editId}`, updatedMinistero),
    onSuccess: () => {
      toast({ title: "Successo", description: "Ministero aggiornato." });
      queryClient.invalidateQueries({ queryKey: ['ministeri'] });
      setEditId(null);
    },
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare il ministero.", variant: "destructive" }),
  });

  // 4. Mutazione per Eliminare un ministero
  const deleteMutation = useMutation({
      mutationFn: (id: string) => apiRequest("DELETE", `/api/ministeri/${id}`),
      onSuccess: () => {
          toast({ title: "Successo", description: "Ministero eliminato." });
          queryClient.invalidateQueries({ queryKey: ['ministeri'] });
      },
      onError: () => toast({ title: "Errore", description: "Impossibile eliminare il ministero.", variant: "destructive" }),
  });


  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.categoria.trim()) {
        toast({ title: "Attenzione", description: "Nome e categoria sono obbligatori.", variant: "destructive" });
        return;
    }
    addMutation.mutate(form);
  };

  const saveEdit = () => {
    if (!editForm.nome.trim() || !editForm.categoria.trim()) {
        toast({ title: "Attenzione", description: "Nome e categoria sono obbligatori.", variant: "destructive" });
        return;
    }
    editMutation.mutate(editForm);
  };

  const handleDelete = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo ministero?')) {
        deleteMutation.mutate(id);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => setLocation("/gestisci")}> <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci </Button>
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-600" />
            <CardTitle className="text-2xl font-bold">Gestisci Ministeri del Governo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Aggiungi, modifica o elimina i ministeri disponibili per la votazione del Governo Ideale.</p>
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-2 mb-6 items-end">
              <Input placeholder="Nome ministero" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required className="md:w-1/3"/>
              <Input placeholder="Categoria (slug)" value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value})} required className="md:w-1/4"/>
              <Input placeholder="Descrizione (opzionale)" value={form.descrizione} onChange={(e) => setForm({...form, descrizione: e.target.value})} className="md:w-1/3"/>
              <Button type="submit" disabled={addMutation.isPending} className="bg-yellow-600 hover:bg-yellow-700">
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Aggiungi
              </Button>
            </form>
            
            {isLoading && <p>Caricamento...</p>}
            {isError && <p className="text-red-600">Errore nel caricamento dei ministeri</p>}
            
            {!isLoading && !isError && (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm bg-white rounded shadow">
                  <thead><tr className="bg-yellow-100"><th className="px-3 py-2 border-b text-left">Nome</th><th className="px-3 py-2 border-b text-left">Categoria</th><th className="px-3 py-2 border-b text-left">Descrizione</th><th className="px-3 py-2 border-b text-right">Azioni</th></tr></thead>
                  <tbody>
                    {ministeri.length === 0 && (<tr><td colSpan={4} className="text-center py-4">Nessun ministero presente.</td></tr>)}
                    {ministeri.map((m) => (
                      <tr key={m.id} className="hover:bg-yellow-50">
                        {editId === m.id ? (
                          <>
                            <td className="px-3 py-2 border-b"><Input value={editForm.nome} onChange={(e) => setEditForm({...editForm, nome: e.target.value})} required /></td>
                            <td className="px-3 py-2 border-b"><Input value={editForm.categoria} onChange={(e) => setEditForm({...editForm, categoria: e.target.value})} required /></td>
                            <td className="px-3 py-2 border-b"><Input value={editForm.descrizione} onChange={(e) => setEditForm({...editForm, descrizione: e.target.value})} /></td>
                            <td className="px-3 py-2 border-b text-right flex gap-2 justify-end">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={editMutation.isPending} onClick={saveEdit}>{editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditId(null)}><XIcon className="h-4 w-4" /></Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 border-b font-medium">{m.nome}</td>
                            <td className="px-3 py-2 border-b">{m.categoria}</td>
                            <td className="px-3 py-2 border-b text-muted-foreground">{m.descrizione}</td>
                            <td className="px-3 py-2 border-b text-right">
                                <div className="flex justify-end gap-2">
                                    <Button size="icon" variant="ghost" onClick={() => { setEditId(m.id); setEditForm(m); }}><Pencil className="h-4 w-4 text-yellow-600" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}