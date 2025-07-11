import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiRequest } from "@/lib/queryClient";

interface Elezione {
  id: string;
  tipo: 'sovranazione' | 'stato' | 'regione' | 'provincia' | 'comune';
  zona: string;
  dataInizio: string;
  dataFine: string;
  circa: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const elezioneSchema = z.object({
  tipo: z.enum(['sovranazione', 'stato', 'regione', 'provincia', 'comune'], {
    required_error: "Tipo di elezione è richiesto",
  }),
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
    defaultValues: {
      tipo: undefined,
      zona: "",
      dataInizio: "",
      dataFine: "",
      circa: false,
    },
  });

  // Watch for tipo changes and reset zona
  const watchedTipo = form.watch('tipo');
  useEffect(() => {
    if (watchedTipo) {
      form.setValue('zona', '');
    }
  }, [watchedTipo, form]);

  // Carica le elezioni all'avvio
  useEffect(() => {
    loadElezioni();
  }, []);

  const loadElezioni = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/api/elezioni');
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
      const response = await apiRequest(method, url, elezioneData);

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
      tipo: elezione.tipo,
      zona: elezione.zona,
      dataInizio: elezione.dataInizio,
      dataFine: elezione.dataFine,
      circa: elezione.circa,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa elezione?')) {
      return;
    }

    try {
      const response = await apiRequest('DELETE', `/api/elezioni/${id}`);

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
      tipo: undefined,
      zona: "",
      dataInizio: "",
      dataFine: "",
      circa: false,
    });
  };

  // Zone options based on tipo selection
  const getZoneOptions = (tipo: string) => {
    switch (tipo) {
      case 'sovranazione':
        return ['Europa'];
      case 'stato':
        return [
          'Austria', 'Belgio', 'Bulgaria', 'Cipro', 'Croazia', 'Danimarca', 
          'Estonia', 'Finlandia', 'Francia', 'Germania', 'Grecia', 'Irlanda', 
          'Italia', 'Lettonia', 'Lituania', 'Lussemburgo', 'Malta', 'Paesi Bassi', 
          'Polonia', 'Portogallo', 'Repubblica Ceca', 'Romania', 'Slovacchia', 
          'Slovenia', 'Spagna', 'Svezia', 'Ungheria'
        ];
      case 'regione':
        return [
          'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 
          'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 
          'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 
          'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto'
        ];
      case 'provincia':
        return ['Pisa', 'Firenze', 'Livorno', 'Lucca', 'Massa-Carrara', 'Pistoia', 'Prato', 'Siena', 'Arezzo', 'Grosseto'];
      case 'comune':
        return [
          'Bientina', 'Buti', 'Calci', 'Calcinaia', 'Capannoli', 'Cascina', 
          'Castelfranco di Sotto', 'Castellina Marittima', 'Castelnuovo di Val di Cecina', 
          'Chianni', 'Crespina Lorenzana', 'Fauglia', 'Guardistallo', 'Lajatico', 
          'Lari', 'Montecatini Val di Cecina', 'Monteverdi Marittimo', 'Montopoli in Val d\'Arno', 
          'Orciano Pisano', 'Palaia', 'Peccioli', 'Pisa', 'Pomarance', 'Ponsacco', 
          'Pontedera', 'Riparbella', 'San Giuliano Terme', 'San Miniato', 'Santa Croce sull\'Arno', 
          'Santa Luce', 'Santa Maria a Monte', 'Terricciola', 'Vecchiano', 'Vicopisano', 'Volterra'
        ];
      default:
        return [];
    }
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

  const safeElezioni = Array.isArray(elezioni) ? elezioni : [];

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
              <DialogDescription>
                {editingElezione ? "Modifica i dettagli dell'elezione selezionata." : "Compila il modulo per aggiungere una nuova elezione al sistema."}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo di Elezione</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona il tipo di elezione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sovranazione">Sovranazione (es: Parlamento Europeo)</SelectItem>
                            <SelectItem value="stato">Stato (es: Italia)</SelectItem>
                            <SelectItem value="regione">Regione (es: Toscana)</SelectItem>
                            <SelectItem value="provincia">Provincia (es: Pisa)</SelectItem>
                            <SelectItem value="comune">Comune (es: San Giuliano Terme)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="zona"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zona</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!form.watch('tipo')}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona la zona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getZoneOptions(form.watch('tipo') || '').map((zona) => (
                              <SelectItem key={zona} value={zona}>
                                {zona}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="circa"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Circa (data approssimativa)
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Se spuntato, sarà sufficiente inserire solo l'anno nelle date
                          </p>
                        </div>
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
                            <Input 
                              type={form.watch('circa') ? "number" : "date"}
                              placeholder={form.watch('circa') ? "Anno (es: 2024)" : ""}
                              min={form.watch('circa') ? "1900" : undefined}
                              max={form.watch('circa') ? "2100" : undefined}
                              {...field} 
                            />
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
                            <Input 
                              type={form.watch('circa') ? "number" : "date"}
                              placeholder={form.watch('circa') ? "Anno (es: 2024)" : ""}
                              min={form.watch('circa') ? "1900" : undefined}
                              max={form.watch('circa') ? "2100" : undefined}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
          ) : safeElezioni.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nessuna elezione trovata. Aggiungi la prima elezione utilizzando il pulsante sopra.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Data Inizio</TableHead>
                    <TableHead>Data Fine</TableHead>
                    <TableHead>Approssimativa</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeElezioni.map((elezione) => (
                    <TableRow key={elezione.id}>
                      <TableCell className="font-medium capitalize">{elezione.tipo}</TableCell>
                      <TableCell>{elezione.zona}</TableCell>
                      <TableCell>{elezione.circa ? elezione.dataInizio : formatDate(elezione.dataInizio)}</TableCell>
                      <TableCell>{elezione.circa ? elezione.dataFine : formatDate(elezione.dataFine)}</TableCell>
                      <TableCell>{elezione.circa ? 'Sì' : 'No'}</TableCell>
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