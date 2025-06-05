import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface Elezione {
  id: string;
  sovranazione: string;
  stato: string;
  regione: string;
  provincia: string;
  comune: string;
  dataInizio: string;
  dataFine: string;
  createdAt?: string;
  updatedAt?: string;
}

const elezioneSchema = z.object({
  sovranazione: z.string().min(1, "Sovranazione è richiesta"),
  stato: z.string().min(1, "Stato è richiesto"),
  regione: z.string().min(1, "Regione è richiesta"),
  provincia: z.string().min(1, "Provincia è richiesta"),
  comune: z.string().min(1, "Comune è richiesto"),
  dataInizio: z.string().min(1, "Data inizio è richiesta"),
  dataFine: z.string().min(1, "Data fine è richiesta"),
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
      sovranazione: "",
      stato: "",
      regione: "",
      provincia: "",
      comune: "",
      dataInizio: "",
      dataFine: "",
    },
  });

  // Carica le elezioni all'avvio
  useEffect(() => {
    loadElezioni();
  }, []);

  const loadElezioni = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/elezioni');
      if (response.ok) {
        const data = await response.json();
        setElezioni(data);
      } else {
        throw new Error('Errore nel caricamento delle elezioni');
      }
    } catch (error) {
      console.error('Errore nel caricamento delle elezioni:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le elezioni",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ElezioneForm) => {
    try {
      setSubmitting(true);

      const elezioneData = {
        ...data,
        updatedAt: new Date().toISOString(),
        ...(editingElezione ? { id: editingElezione.id } : {}),
      };

      const url = editingElezione ? `/api/elezioni/${editingElezione.id}` : '/api/elezioni';
      const method = editingElezione ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(elezioneData),
      });

      if (response.ok) {
        toast({
          title: "Successo",
          description: editingElezione ? "Elezione aggiornata con successo" : "Elezione creata con successo",
        });
        
        setIsDialogOpen(false);
        resetForm();
        loadElezioni();
      } else {
        throw new Error('Errore nella gestione dell\'elezione');
      }
    } catch (error) {
      console.error('Errore nella gestione dell\'elezione:', error);
      toast({
        title: "Errore",
        description: "Impossibile gestire l'elezione",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (elezione: Elezione) => {
    setEditingElezione(elezione);
    form.reset({
      sovranazione: elezione.sovranazione,
      stato: elezione.stato,
      regione: elezione.regione,
      provincia: elezione.provincia,
      comune: elezione.comune,
      dataInizio: elezione.dataInizio,
      dataFine: elezione.dataFine,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa elezione?')) {
      return;
    }

    try {
      const response = await fetch(`/api/elezioni/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Successo",
          description: "Elezione eliminata con successo",
        });
        loadElezioni();
      } else {
        throw new Error('Errore nell\'eliminazione dell\'elezione');
      }
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'elezione:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'elezione",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingElezione(null);
    form.reset({
      sovranazione: "",
      stato: "",
      regione: "",
      provincia: "",
      comune: "",
      dataInizio: "",
      dataFine: "",
    });
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" className="mr-2" asChild>
            <Link to="/menu">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Gestisci Elezioni</h1>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Elezione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingElezione ? "Modifica Elezione" : "Aggiungi Nuova Elezione"}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sovranazione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sovranazione</FormLabel>
                        <FormControl>
                          <Input placeholder="es: Parlamento Europeo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="stato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stato</FormLabel>
                        <FormControl>
                          <Input placeholder="es: Italia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="regione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regione</FormLabel>
                        <FormControl>
                          <Input placeholder="es: Toscana" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="provincia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provincia</FormLabel>
                        <FormControl>
                          <Input placeholder="es: Pisa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="comune"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comune</FormLabel>
                        <FormControl>
                          <Input placeholder="es: San Giuliano Terme" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="md:col-span-1"></div>
                  
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
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Salvando..." : editingElezione ? "Aggiorna" : "Crea"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Lista Elezioni
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Caricamento elezioni...</div>
          ) : elezioni.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nessuna elezione trovata. Aggiungi la prima elezione utilizzando il pulsante sopra.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sovranazione</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Regione</TableHead>
                    <TableHead>Provincia</TableHead>
                    <TableHead>Comune</TableHead>
                    <TableHead>Data Inizio</TableHead>
                    <TableHead>Data Fine</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {elezioni.map((elezione) => (
                    <TableRow key={elezione.id}>
                      <TableCell className="font-medium">{elezione.sovranazione}</TableCell>
                      <TableCell>{elezione.stato}</TableCell>
                      <TableCell>{elezione.regione}</TableCell>
                      <TableCell>{elezione.provincia}</TableCell>
                      <TableCell>{elezione.comune}</TableCell>
                      <TableCell>{formatDate(elezione.dataInizio)}</TableCell>
                      <TableCell>{formatDate(elezione.dataFine)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(elezione)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(elezione.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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