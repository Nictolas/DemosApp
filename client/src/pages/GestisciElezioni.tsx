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

// Interfaccia aggiornata per corrispondere ai dati dell'API
interface Elezione {
  id: string;
  titolo: string;
  descrizione: string;
  tipo: string;
  zona: string;
  data_inizio: string;
  data_fine: string;
  status: string;
  quorum: number;
  candidati: any;
  regole: any;
  note: string;
  circa: string;
  createdAt: string;
  updatedAt: string;
}

const elezioneSchema = z.object({
  titolo: z.string().min(1, "Titolo è richiesto"),
  descrizione: z.string().min(1, "Descrizione è richiesta"),
  tipo: z.string().min(1, "Tipo è richiesto"),
  zona: z.string().min(1, "Zona è richiesta"),
  data_inizio: z.string().min(1, "Data inizio è richiesta"),
  data_fine: z.string().min(1, "Data fine è richiesta"),
  quorum: z.number().min(0, "Quorum deve essere >= 0"),
  note: z.string().optional(),
  circa: z.string().optional(),
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
    defaultValues: { 
      titolo: "", 
      descrizione: "", 
      tipo: "generale", 
      zona: "", 
      data_inizio: "", 
      data_fine: "", 
      quorum: 50,
      note: "",
      circa: ""
    },
  });

  // === INIZIO MODIFICHE PRINCIPALI ===
  const loadElezioni = async () => {
    setLoading(true);
    try {
      // 1. Carica le elezioni tramite API
      const response = await apiRequest("GET", "/api/elezioni");
      if (!response.ok) throw new Error("Errore nel caricamento.");
      const result = await response.json();
      
      // Estrai i dati dalla risposta { success: true, data: [...] }
      if (result.success && Array.isArray(result.data)) {
        setElezioni(result.data);
      } else {
        console.error('❌ DEBUG: Formato risposta API non valido:', result);
        setElezioni([]);
      }
    } catch (error) {
      console.error('❌ DEBUG: Errore nel caricamento elezioni:', error);
      toast({ title: "Errore", description: "Impossibile caricare le elezioni", variant: "destructive" });
      setElezioni([]);
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
      // Converti le date per l'API
      const elezioneData = {
        ...data,
        data_inizio: new Date(data.data_inizio).toISOString(),
        data_fine: new Date(data.data_fine).toISOString()
      };

      let response;
      if (editingElezione) {
        // 2. Aggiorna un'elezione esistente tramite API
        response = await apiRequest("PUT", `/api/elezioni/${editingElezione.id}`, elezioneData);
      } else {
        // 3. Crea una nuova elezione tramite API
        response = await apiRequest("POST", "/api/elezioni", elezioneData);
      }

      if (!response.ok) throw new Error("Salvataggio fallito.");

      toast({ title: "Successo", description: `Elezione ${editingElezione ? 'aggiornata' : 'creata'} con successo` });
      setIsDialogOpen(false);
      resetForm();
      await loadElezioni();
    } catch (error) {
      console.error('❌ DEBUG: Errore nel salvataggio:', error);
      toast({ title: "Errore", description: "Impossibile salvare l'elezione", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (elezione: Elezione) => {
    setEditingElezione(elezione);
    form.reset({
      titolo: elezione.titolo || "",
      descrizione: elezione.descrizione || "",
      tipo: elezione.tipo || "generale",
      zona: elezione.zona || "",
      data_inizio: elezione.data_inizio ? elezione.data_inizio.slice(0, 16) : "", // Formato per datetime-local
      data_fine: elezione.data_fine ? elezione.data_fine.slice(0, 16) : "", // Formato per datetime-local
      quorum: elezione.quorum || 50,
      note: elezione.note || "",
      circa: elezione.circa || ""
    });
    setIsDialogOpen(true);
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

  const resetForm = () => {
    setEditingElezione(null);
    form.reset({ 
      titolo: "", 
      descrizione: "", 
      tipo: "generale", 
      zona: "", 
      data_inizio: "", 
      data_fine: "", 
      quorum: 50,
      note: "",
      circa: ""
    });
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
                <FormField control={form.control} name="titolo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titolo</FormLabel>
                    <FormControl><Input placeholder="Titolo dell'elezione" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="descrizione" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl><Input placeholder="Descrizione dell'elezione" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo di Elezione</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona un tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="generale">Generale</SelectItem>
                        <SelectItem value="comunale">Comunale</SelectItem>
                        <SelectItem value="regionale">Regionale</SelectItem>
                        <SelectItem value="nazionale">Nazionale</SelectItem>
                        <SelectItem value="europea">Europea</SelectItem>
                        <SelectItem value="referendum">Referendum</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="zona" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <FormControl><Input placeholder="Zona geografica" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="data_inizio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inizio</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="data_fine" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fine</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="quorum" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quorum (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="note" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl><Input placeholder="Note aggiuntive" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="circa" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circa</FormLabel>
                    <FormControl><Input placeholder="Informazioni aggiuntive" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Inizio</TableHead>
                    <TableHead>Data Fine</TableHead>
                    <TableHead>Quorum</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {elezioni.map((elezione) => (
                    <TableRow key={elezione.id}>
                      <TableCell className="font-medium">{elezione.titolo}</TableCell>
                      <TableCell className="capitalize">{elezione.tipo}</TableCell>
                      <TableCell>{elezione.zona}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          elezione.status === 'attiva' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {elezione.status}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(elezione.data_inizio)}</TableCell>
                      <TableCell>{formatDate(elezione.data_fine)}</TableCell>
                      <TableCell>{elezione.quorum}%</TableCell>
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