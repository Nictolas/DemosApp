import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// === AGGIUNTO ===
import { apiRequest } from "@/lib/queryClient";

// L'interfaccia e lo schema rimangono identici
interface Elezione {
  id: string;
  tipo: 'sovranazione' | 'stato' | 'regione' | 'provincia' | 'comune';
  zona: string;
  dataInizio: string;
  dataFine: string;
  circa: boolean;
}

const elezioneSchema = z.object({
  tipo: z.enum(['sovranazione', 'stato', 'regione', 'provincia', 'comune']),
  zona: z.string().min(1, "Zona è richiesta"),
  dataInizio: z.string().min(1, "Data inizio è richiesta"),
  dataFine: z.string().min(1, "Data fine è richiesta"),
  circa: z.boolean().default(false),
});

type ElezioneForm = z.infer<typeof elezioneSchema>;

export default function GestisciElezioni() {
  const [elezioni, setElezioni] = useState<Elezione[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingElezione, setEditingElezione] = useState<Elezione | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<ElezioneForm>({
    resolver: zodResolver(elezioneSchema),
    defaultValues: { zona: "", dataInizio: "", dataFine: "", circa: false },
  });

  // === INIZIO MODIFICHE PRINCIPALI ===
  const loadElezioni = async () => {
    setLoading(true);
    try {
      // 1. Carica le elezioni tramite API
      const response = await apiRequest("GET", "/api/elezioni");
      if (!response.ok) throw new Error("Errore nel caricamento.");
      const data = await response.json();
      setElezioni(data);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile caricare le elezioni", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElezioni();
  }, []);

  const handleSubmit = async (data: ElezioneForm) => {
    setSubmitting(true);
    try {
      let response;
      if (editingElezione) {
        // 2. Aggiorna un'elezione esistente tramite API
        response = await apiRequest("PUT", `/api/elezioni/${editingElezione.id}`, data);
      } else {
        // 3. Crea una nuova elezione tramite API
        response = await apiRequest("POST", "/api/elezioni", data);
      }

      if (!response.ok) throw new Error("Salvataggio fallito.");

      toast({ title: "Successo", description: `Elezione ${editingElezione ? 'aggiornata' : 'creata'} con successo` });
      setIsDialogOpen(false);
      resetForm();
      await loadElezioni();
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile salvare l'elezione", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa elezione?')) return;
    try {
      // 4. Elimina un'elezione tramite API
      const response = await apiRequest("DELETE", `/api/elezioni/${id}`);
      if (!response.ok) throw new Error("Eliminazione fallita.");
      
      toast({ title: "Successo", description: "Elezione eliminata con successo" });
      await loadElezioni();
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'elezione", variant: "destructive" });
    }
  };
  // === FINE MODIFICHE PRINCIPALI ===

  const handleEdit = (elezione: Elezione) => {
    setEditingElezione(elezione);
    form.reset({ ...elezione });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingElezione(null);
    form.reset({ tipo: undefined, zona: "", dataInizio: "", dataFine: "", circa: false });
  };
  
  const watchedTipo = form.watch('tipo');
  useEffect(() => {
    if (watchedTipo) form.setValue('zona', '');
  }, [watchedTipo, form]);

  const getZoneOptions = (tipo?: string) => {
    if (!tipo) return [];
    // ... (questa logica rimane identica)
    switch (tipo) {
      case 'sovranazione': return ['Europa'];
      case 'stato': return ['Austria', 'Belgio', /* ...tutti gli stati... */, 'Italia', /* ... */ 'Ungheria'];
      case 'regione': return ['Abruzzo', 'Basilicata', /* ...tutte le regioni... */, 'Veneto'];
      case 'provincia': return ['Pisa', 'Firenze', /* ...etc... */];
      case 'comune': return ['Bientina', 'Buti', /* ...etc... */];
      default: return [];
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetForm();
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('it-IT');
  
  // Il resto del codice JSX per la visualizzazione rimane IDENTICO
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" className="mr-2" asChild>
            <Link to="/menu"><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Link>
          </Button>
          <h1 className="text-2xl font-bold">Gestisci Elezioni</h1>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Aggiungi Elezione</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingElezione ? "Modifica Elezione" : "Aggiungi Nuova Elezione"}</DialogTitle>
              <DialogDescription>{editingElezione ? "Modifica i dettagli dell'elezione." : "Compila il modulo per creare una nuova elezione."}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo di Elezione</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona un tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="sovranazione">Sovranazione</SelectItem>
                        <SelectItem value="stato">Stato</SelectItem>
                        <SelectItem value="regione">Regione</SelectItem>
                        <SelectItem value="provincia">Provincia</SelectItem>
                        <SelectItem value="comune">Comune</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="zona" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!watchedTipo}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona la zona" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {getZoneOptions(watchedTipo).map((zona) => <SelectItem key={zona} value={zona}>{zona}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="circa" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Circa (data approssimativa)</FormLabel>
                      <p className="text-sm text-muted-foreground">Se spuntato, inserisci solo l'anno nelle date.</p>
                    </div>
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="dataInizio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inizio</FormLabel>
                      <FormControl><Input type={form.watch('circa') ? "number" : "date"} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dataFine" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fine</FormLabel>
                      <FormControl><Input type={form.watch('circa') ? "number" : "date"} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>Annulla</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salva Elezione"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Calendar className="h-5 w-5 mr-2" />Lista Elezioni</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8">Caricamento...</div>
          : elezioni.length === 0 ? <div className="text-center py-8 text-gray-500">Nessuna elezione trovata.</div>
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Zona</TableHead><TableHead>Data Inizio</TableHead><TableHead>Data Fine</TableHead><TableHead>Circa</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
                <TableBody>
                  {elezioni.map((elezione) => (
                    <TableRow key={elezione.id}>
                      <TableCell className="font-medium capitalize">{elezione.tipo}</TableCell>
                      <TableCell>{elezione.zona}</TableCell>
                      <TableCell>{elezione.circa ? elezione.dataInizio : formatDate(elezione.dataInizio)}</TableCell>
                      <TableCell>{elezione.circa ? elezione.dataFine : formatDate(elezione.dataFine)}</TableCell>
                      <TableCell>{elezione.circa ? 'Sì' : 'No'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(elezione)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(elezione.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}