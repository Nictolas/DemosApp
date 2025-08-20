import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, Calendar, Vote, MapPin, Clock, Users, Target } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// === AGGIUNTO ===
import { apiRequest } from "@/lib/queryClient";

// Stili personalizzati per line-clamp
const lineClampStyles = {
  lineClamp2: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
};

// Interfaccia corretta per corrispondere ai dati di Firestore migrati
interface Elezione {
  id: string;
  tipo: string; // 'sovranazione', 'stato', 'regione', 'provincia', 'comune'
  zona: string;
  circa: boolean;
  datainizio: string; // Anno come stringa
  datafine: string; // Anno come stringa
  createdAt: string;
  updatedAt: string;
}

const elezioneSchema = z.object({
  tipo: z.enum(['sovranazione', 'stato', 'regione', 'provincia', 'comune']),
  zona: z.string().min(1, "Zona è richiesta"),
  datainizio: z.string().min(1, "Anno inizio è richiesto"),
  datafine: z.string().min(1, "Anno fine è richiesto"),
  circa: z.boolean().default(true),
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
      tipo: "stato", 
      zona: "", 
      datainizio: "", 
      datafine: "", 
      circa: true
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
      console.error('❌ DEBUG: Errore nel salvataggio:', error);
      toast({ title: "Errore", description: "Impossibile salvare l'elezione", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (elezione: Elezione) => {
    setEditingElezione(elezione);
    form.reset({
      tipo: elezione.tipo as any || "stato",
      zona: elezione.zona || "",
      datainizio: elezione.datainizio || "",
      datafine: elezione.datafine || "",
      circa: elezione.circa || true
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
      tipo: "stato", 
      zona: "", 
      datainizio: "", 
      datafine: "", 
      circa: true
    });
  };
  


  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetForm();
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('it-IT');
  
  // Il resto del codice JSX per la visualizzazione rimane IDENTICO
  return (
         <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
       <div className="container mx-auto px-4 py-8">
         {/* Header migliorato */}
         <div className="text-center mb-8">
           <div className="flex items-center justify-center mb-4">
             <Button variant="ghost" className="mr-4 hover:bg-white/50" asChild>
               <Link to="/menu"><ArrowLeft className="h-5 w-5 mr-2" />Indietro</Link>
             </Button>
             <div className="flex items-center space-x-3">
               <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
                 <Vote className="h-8 w-8 text-white" />
               </div>
               <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                 Gestisci Elezioni
               </h1>
             </div>
           </div>
           <p className="text-lg text-gray-600 max-w-2xl mx-auto">
             Amministra le elezioni, i referendum e le consultazioni pubbliche della piattaforma
           </p>
         </div>
         
         {/* Pulsante Aggiungi Elezione migliorato */}
         <div className="flex justify-center mb-8">
           <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
             <DialogTrigger asChild>
               <Button 
                 onClick={() => setIsDialogOpen(true)}
                 className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
               >
                 <Plus className="h-6 w-6 mr-3" />
                 Aggiungi Nuova Elezione
               </Button>
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
                       <FormControl><Input placeholder="Zona geografica" {...field} /></FormControl>
                       <FormMessage />
                     </FormItem>
                   )} />
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="datainizio" render={({ field }) => (
                       <FormItem>
                         <FormLabel>Anno Inizio</FormLabel>
                         <FormControl><Input type="number" min="2020" max="2050" placeholder="2024" {...field} /></FormControl>
                         <FormMessage />
                       </FormItem>
                     )} />
                     <FormField control={form.control} name="datafine" render={({ field }) => (
                       <FormItem>
                         <FormLabel>Anno Fine</FormLabel>
                         <FormControl><Input type="number" min="2020" max="2050" placeholder="2024" {...field} /></FormControl>
                         <FormMessage />
                       </FormItem>
                     )} />
                   </div>
                   <FormField control={form.control} name="circa" render={({ field }) => (
                     <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                       <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                       <div className="space-y-1 leading-none">
                         <FormLabel>Circa (data approssimativa)</FormLabel>
                         <p className="text-sm text-muted-foreground">Se spuntato, le date sono approssimative.</p>
                       </div>
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
             {/* Statistiche generali */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
           <CardContent className="p-4">
             <div className="flex items-center space-x-3">
               <div className="p-2 bg-blue-500 rounded-lg">
                 <Vote className="h-5 w-5 text-white" />
               </div>
               <div>
                 <p className="text-sm font-medium text-blue-600">Totale Elezioni</p>
                 <p className="text-2xl font-bold text-blue-900">{elezioni.length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
           <CardContent className="p-4">
             <div className="flex items-center space-x-3">
               <div className="p-2 bg-green-500 rounded-lg">
                 <Calendar className="h-5 w-5 text-white" />
               </div>
               <div>
                 <p className="text-sm font-medium text-green-600">Sovranazione</p>
                 <p className="text-2xl font-bold text-green-900">{elezioni.filter(e => e.tipo === 'sovranazione').length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
           <CardContent className="p-4">
             <div className="flex items-center space-x-3">
               <div className="p-2 bg-purple-500 rounded-lg">
                 <Target className="h-5 w-5 text-white" />
               </div>
               <div>
                 <p className="text-sm font-medium text-purple-600">Stato</p>
                 <p className="text-2xl font-bold text-purple-900">{elezioni.filter(e => e.tipo === 'stato').length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
           <CardContent className="p-4">
             <div className="flex items-center space-x-3">
               <div className="p-2 bg-orange-500 rounded-lg">
                 <Users className="h-5 w-5 text-white" />
               </div>
               <div>
                 <p className="text-sm font-medium text-orange-600">Regione</p>
                 <p className="text-2xl font-bold text-orange-900">{elezioni.filter(e => e.tipo === 'regione').length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>

       {/* Lista Elezioni con schede moderne */}
       <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
         <CardHeader className="pb-4">
           <CardTitle className="flex items-center text-2xl text-gray-800">
             <Calendar className="h-6 w-6 mr-3 text-blue-600" />
             Lista Elezioni
           </CardTitle>
         </CardHeader>
         <CardContent>
           {loading ? (
             <div className="flex items-center justify-center py-12">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
               <span className="ml-3 text-lg text-gray-600">Caricamento elezioni...</span>
             </div>
           ) : elezioni.length === 0 ? (
             <div className="text-center py-12">
               <Vote className="h-16 w-16 text-gray-400 mx-auto mb-4" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna elezione trovata</h3>
               <p className="text-gray-500">Crea la tua prima elezione per iniziare</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
               {elezioni.map((elezione) => (
                 <Card key={elezione.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-blue-100">
                   <CardContent className="p-6">
                     {/* Header con status */}
                     <div className="flex items-start justify-between mb-4">
                       <div className="flex-1">
                         <h3 className="text-lg font-semibold text-gray-900 mb-2 capitalize">{elezione.tipo}</h3>
                         <p className="text-sm text-gray-600">{elezione.zona}</p>
                       </div>
                       <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                         elezione.circa 
                           ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                           : 'bg-blue-100 text-blue-800 border border-blue-200'
                       }`}>
                         {elezione.circa ? 'Circa' : 'Esatta'}
                       </span>
                     </div>
                     
                     {/* Dettagli elezione */}
                     <div className="space-y-3 mb-4">
                       <div className="flex items-center space-x-2">
                         <Vote className="h-4 w-4 text-blue-500" />
                         <span className="text-sm text-gray-600 capitalize">{elezione.tipo}</span>
                       </div>
                       
                       <div className="flex items-center space-x-2">
                         <MapPin className="h-4 w-4 text-green-500" />
                         <span className="text-sm text-gray-600">{elezione.zona}</span>
                       </div>
                       
                       <div className="flex items-center space-x-2">
                         <Clock className="h-4 w-4 text-purple-500" />
                         <span className="text-sm text-gray-600">
                           {elezione.datainizio} - {elezione.datafine}
                         </span>
                       </div>
                       
                       <div className="flex items-center space-x-2">
                         <Target className="h-4 w-4 text-orange-500" />
                         <span className="text-sm text-gray-600">
                           Creata: {formatDate(elezione.createdAt)}
                         </span>
                       </div>
                     </div>
                     
                     {/* Azioni */}
                     <div className="flex space-x-2 pt-3 border-t border-gray-100">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         onClick={() => handleEdit(elezione)}
                         className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                       >
                         <Edit className="h-4 w-4 mr-2" />
                         Modifica
                       </Button>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         onClick={() => handleDelete(elezione.id)}
                         className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                       >
                         <Trash2 className="h-4 w-4 mr-2" />
                         Elimina
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   </div>
 );
}