import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, Clock, MapPin, Trash2, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ITALY_DATA } from "@/data/italyData";
import DatePicker from "@/components/DatePicker";
import { formatEventoLocation, formatEventoElezioniLocation, decompressPaeseEvento, decompressRegioneEvento, decompressProvinciaEvento, compressPaeseEvento, compressRegioneEvento, compressProvinciaEvento } from "@/utils/eventiGeographicUtils";

// Schema di validazione per il form di modifica
const eventoSchema = z.object({
  nome_evento: z.string().min(1, "Il nome dell'evento è obbligatorio"),
  tipologia_evento: z.string().min(1, "La tipologia è obbligatoria"),
  tipo_elezione: z.string().optional(),
  paese_evento: z.string().min(1, "Il paese è obbligatorio"),
  regione_evento: z.string().optional(),
  provincia_evento: z.string().optional(),
  comune_evento: z.string().optional(),
  indirizzo_evento: z.string().optional(),
  giorno_inizio: z.string().min(1, "Il giorno di inizio è obbligatorio"),
  giorno_fine: z.string().optional(),
  orario_inizio: z.string().optional(),
  orario_fine: z.string().optional(),
  orario_inizio_giorno2: z.string().optional(),
  orario_fine_giorno2: z.string().optional(),
}).refine((data) => {
  // Se la tipologia NON è "Elezioni", allora regione, provincia e comune sono obbligatori
  if (data.tipologia_evento !== "Elezioni") {
    return data.regione_evento && data.regione_evento.trim().length > 0 &&
           data.provincia_evento && data.provincia_evento.trim().length > 0 &&
           data.comune_evento && data.comune_evento.trim().length > 0;
  }
  // Se è "Elezioni", richiedi almeno la tipologia specifica di elezione
  return !!data.tipo_elezione && data.tipo_elezione.trim().length > 0;
}, {
  message: "Per gli eventi non elettorali sono obbligatorie regione, provincia e comune. Per le elezioni è obbligatorio scegliere la tipologia.",
  path: ["regione_evento"]
});

type EventoFormData = z.infer<typeof eventoSchema>;

// Helper functions per formattare date e orari
const formatDate = (dateString: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTime = (timeString: string | null) => {
  if (!timeString) return null;
  return timeString;
};

export default function Eventi() {
  const { user, isLoading } = useAuth();
  
  // Check if user is admin
  const isAdmin = user?.ruolo === "AD";
  
  // State for admin tabs
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');

  // Fetch eventi data from API
  const { data: eventiResponse, isLoading: eventiLoading, refetch } = useQuery<any>({
    queryKey: ["/api/eventi", isAdmin ? activeTab : 'personal'],
    queryFn: async () => {
      const url = isAdmin && activeTab === 'global' 
        ? "/api/eventi?view=global" 
        : "/api/eventi?view=personal";
      const response = await apiRequest("GET", url);
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento degli eventi";
        throw new Error(errorMsg);
      }
      const result = response.data;
      if (!result.success) {
        throw new Error(result.error || "Errore nel caricamento degli eventi");
      }
      return result;
    },
    enabled: !!user,
  });

  // Extract eventi array from API response (filtering is now done server-side)
  const eventi = (eventiResponse?.data && Array.isArray(eventiResponse.data)) ? eventiResponse.data : [];

  // Function to delete event
  const deleteEvent = async (eventId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo evento?')) {
      return;
    }

    try {
      console.log('🗑️ Tentativo eliminazione evento:', eventId);
      const response = await apiRequest("DELETE", `/api/eventi/${eventId}`);
      console.log('✅ Risposta eliminazione:', response);
      
      if (response?.ok && response?.data?.success) {
        // Refresh the eventi list
        refetch();
        alert('Evento eliminato con successo!');
      } else {
        const errorMsg = response?.data?.error || response?.data?.message || 'Errore nell\'eliminazione dell\'evento';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Errore eliminazione:', error);
      alert('Errore nell\'eliminazione dell\'evento');
    }
  };

  // Function to edit event
  const editEvent = (evento: any) => {
    setEditingEvent(evento);
    setIsEditModalOpen(true);
  };

  // Function to check if user can edit/delete event
  const canEditEvent = (evento: any) => {
    // Admin can edit/delete all events
    if (isAdmin) {
      return true;
    }
    
    // Non-admin users can only edit/delete events they created
    return evento.organizzatore === user?.email || 
           (user?.nome && user?.cognome && evento.organizzatore === `${user.nome} ${user.cognome}`);
  };

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<any>(null);

  // Form for editing
  const editForm = useForm<EventoFormData>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      nome_evento: "",
      tipologia_evento: "",
      tipo_elezione: "",
      paese_evento: "Italia",
      regione_evento: "",
      provincia_evento: "",
      comune_evento: "",
      indirizzo_evento: "",
      giorno_inizio: "",
      giorno_fine: "",
      orario_inizio: "",
      orario_fine: "",
      orario_inizio_giorno2: "",
      orario_fine_giorno2: "",
    },
  });

  // Watch tipologia_evento for conditional rendering
  const watchTipologiaEvento = editForm.watch("tipologia_evento");
  const watchGiornoInizio = editForm.watch("giorno_inizio");
  const watchGiornoFine = editForm.watch("giorno_fine");

  // Update form when editing event changes
  React.useEffect(() => {
    if (editingEvent) {
      editForm.reset({
        nome_evento: editingEvent.nome_evento || "",
        tipologia_evento: editingEvent.tipologia_evento || "",
        tipo_elezione: editingEvent.tipo_elezione || "",
        paese_evento: decompressPaeseEvento(editingEvent.paese_evento) || "Italia",
        regione_evento: decompressRegioneEvento(editingEvent.regione_evento) || "",
        provincia_evento: decompressProvinciaEvento(editingEvent.provincia_evento) || "",
        comune_evento: editingEvent.comune_evento || "",
        indirizzo_evento: editingEvent.indirizzo_evento || "",
        giorno_inizio: editingEvent.giorno_inizio ? editingEvent.giorno_inizio.split('T')[0] : "",
        giorno_fine: editingEvent.giorno_fine ? editingEvent.giorno_fine.split('T')[0] : "",
        orario_inizio: editingEvent.orario_inizio || "",
        orario_fine: editingEvent.orario_fine || "",
        orario_inizio_giorno2: editingEvent.orario_inizio_giorno2 || "",
        orario_fine_giorno2: editingEvent.orario_fine_giorno2 || "",
      });
    }
  }, [editingEvent, editForm]);

  // Update event mutation
  const updateEvento = useMutation({
    mutationFn: async (data: EventoFormData) => {
      if (!editingEvent?.id) throw new Error('ID evento mancante');
      
      // Comprimi i dati geografici per il database
      const compressedData = {
        ...data,
        paese_evento: compressPaeseEvento(data.paese_evento),
        regione_evento: compressRegioneEvento(data.regione_evento),
        provincia_evento: compressProvinciaEvento(data.provincia_evento),
        organizzatore: user?.nome && user?.cognome ? `${user.nome} ${user.cognome}` : user?.email || "Utente"
      };
      
      console.log('📤 Invio dati evento aggiornati (compressi):', compressedData);
      const response = await apiRequest.put(`/api/eventi/${editingEvent.id}`, compressedData);
      console.log('📥 Risposta server:', response);
      
      if (!response?.ok || !response?.data?.success) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nell'aggiornamento dell'evento";
        console.error('❌ Errore server:', errorMsg);
        throw new Error(errorMsg);
      }
      return response.data;
    },
    onSuccess: (data) => {
      console.log('✅ onSuccess chiamato con dati:', data);
      toast({
        title: "Evento aggiornato",
        description: "Il tuo evento è stato aggiornato con successo.",
      });
      setIsEditModalOpen(false);
      setEditingEvent(null);
      refetch();
    },
    onError: (error) => {
      console.error('❌ Errore aggiornamento evento:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento dell'evento",
        variant: "destructive",
      });
    },
  });

  const onSubmitEdit = (data: EventoFormData) => {
    console.log('📝 Dati form per aggiornamento:', data);
    updateEvento.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 select-none page-with-navbar" style={{ paddingBottom: '280px' }}>
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Eventi</h1>
          </div>
          <p className="text-lg text-gray-600">
            {isAdmin 
              ? "Gestisci e visualizza tutti gli eventi della piattaforma"
              : "Calendario degli eventi organizzati dai tuoi rappresentanti e candidati"
            }
          </p>
          {!isAdmin && (
            <p className="text-sm text-blue-600 mt-2">
              ℹ️ Gli eventi "Elezioni" vengono mostrati solo per la tua regione
            </p>
          )}
        </div>

        {/* Admin Tabs */}
        {isAdmin && (
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-sm border">
              <button
                onClick={() => setActiveTab('personal')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'personal'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Personali
              </button>
              <button
                onClick={() => setActiveTab('global')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'global'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Globale
              </button>
            </div>
          </div>
        )}

        {/* Schede Eventi */}
        <div className="space-y-4">
          {eventiLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-gray-600 mt-2">Caricamento eventi...</p>
            </div>
          ) : eventi.length > 0 ? (
            eventi.map((evento: any) => (
              <div
                key={evento.id}
                className={`rounded-xl shadow-lg border p-6 hover:shadow-xl transition-shadow ${
                  evento.tipologia_evento === 'Elezioni'
                    ? (evento.tipo_elezione && evento.tipo_elezione.toLowerCase() === 'europee')
                      ? 'bg-blue-50 border-blue-200 shadow-blue-100'
                      : 'bg-yellow-50 border-yellow-200 shadow-yellow-100'
                    : 'bg-white border-gray-100'
                }`}
              >
                                            {/* Nome Evento */}
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                {evento.tipologia_evento === 'Elezioni' && (
                                  <span className="text-2xl">🗳️</span>
                                )}
                                {evento.nome_evento}
                              </h3>
                              <div className="flex items-center gap-2">
                                {evento.tipologia_evento === 'Elezioni' && (
                                  <span className="bg-yellow-200 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                                    {evento.tipo_elezione
                                      ? `Elezioni – ${evento.tipo_elezione === 'Politiche_nazionali'
                                          ? 'Politiche nazionali (Camera e Senato)'
                                          : evento.tipo_elezione
                                        }`
                                      : 'Elezioni'}
                                  </span>
                                )}
                                {canEditEvent(evento) && (
                                  <>
                                    <button
                                      onClick={() => editEvent(evento)}
                                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                                      title="Modifica evento"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteEvent(evento.id)}
                                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                      title="Elimina evento"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Organizzatore - Solo per eventi non "Elezioni" */}
                            {evento.tipologia_evento !== 'Elezioni' && (
                              <div className="mb-3">
                                <span className="text-gray-700 font-medium">
                                  {evento.organizzatore || 'Organizzatore non specificato'}
                                </span>
                              </div>
                            )}
                            
                            {/* Luogo - Solo per eventi non "Elezioni" */}
                            {evento.tipologia_evento !== 'Elezioni' && (
                              <div className="mb-3 flex items-center">
                                <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                                <span className="text-gray-600">
                                  {formatEventoLocation(evento) || 'Luogo non specificato'}
                                </span>
                              </div>
                            )}
                            
                            {/* Luogo per eventi "Elezioni": non mostrare per comunali; per gli altri solo se disponibile */}
                            {evento.tipologia_evento === 'Elezioni' && evento.tipo_elezione !== 'comunali' && (() => {
                              const location = formatEventoElezioniLocation(evento);
                              if (!location) return null;
                              return (
                                <div className="mb-3 flex items-center">
                                  <MapPin className="h-4 w-4 text-yellow-600 mr-2" />
                                  <span className="text-gray-700 font-medium">
                                    {location}
                                  </span>
                                </div>
                              );
                            })()}
                            
                            {/* Date e Orari - Solo per eventi non "Elezioni" */}
                            {evento.tipologia_evento !== 'Elezioni' && (
                              <div className="space-y-2">
                                {/* Giorno di Inizio */}
                                {evento.giorno_inizio && (
                                  <div className="flex items-center">
                                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      Inizio: {formatDate(evento.giorno_inizio)}
                                      {evento.orario_inizio && (
                                        <> · {formatTime(evento.orario_inizio)}{evento.orario_fine && <>–{formatTime(evento.orario_fine)}</>}</>
                                      )}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Giorno di Fine */}
                                {evento.giorno_fine && evento.giorno_fine !== evento.giorno_inizio && (
                                  <div className="flex items-center">
                                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      Secondo giorno: {formatDate(evento.giorno_fine)}
                                      {evento.orario_inizio_giorno2 && (
                                        <> · {formatTime(evento.orario_inizio_giorno2)}{evento.orario_fine_giorno2 && <>–{formatTime(evento.orario_fine_giorno2)}</>}</>
                                      )}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Orari senza secondo giorno */}
                                {evento.giorno_fine && evento.giorno_fine === evento.giorno_inizio && !evento.orario_inizio_giorno2 && (
                                  <>
                                    {evento.orario_inizio && (
                                      <div className="flex items-center">
                                        <Clock className="h-4 w-4 text-gray-500 mr-2" />
                                        <span className="text-gray-600">
                                          Orario inizio: {formatTime(evento.orario_inizio)}
                                        </span>
                                      </div>
                                    )}
                                    {evento.orario_fine && (
                                      <div className="flex items-center">
                                        <Clock className="h-4 w-4 text-gray-500 mr-2" />
                                        <span className="text-gray-600">
                                          Orario fine: {formatTime(evento.orario_fine)}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {/* Fallback per orario_evento se non ci sono i nuovi campi */}
                                {!evento.giorno_inizio && !evento.orario_inizio && evento.orario_evento && (
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      {evento.orario_evento}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Per eventi "Elezioni" - Mostra date disponibili */}
                            {evento.tipologia_evento === 'Elezioni' && evento.giorno_inizio && (
                              <div className="space-y-2">
                                {/* Data di Inizio */}
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 text-yellow-600 mr-2" />
                                  <span className="text-gray-700 font-medium">
                                    {evento.giorno_fine ? 'Inizio: ' : 'Data: '}{formatDate(evento.giorno_inizio)}
                                  </span>
                                </div>
                                
                                {/* Data di Fine - Solo se disponibile */}
                                {evento.giorno_fine && (
                                  <div className="flex items-center">
                                    <Calendar className="h-4 w-4 text-yellow-600 mr-2" />
                                    <span className="text-gray-700 font-medium">
                                      Fine: {formatDate(evento.giorno_fine)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun evento programmato al momento.</p>
              {!isAdmin && (
                <p className="text-sm text-gray-400 mt-2">
                  Gli eventi "Elezioni" vengono mostrati solo per la tua regione ({user?.regione || 'non specificata'}).
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal per modificare evento */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Modifica Evento
            </DialogTitle>
            <DialogDescription>
              Aggiorna le informazioni del tuo evento
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-6">
              {/* Nome Evento */}
              <FormField
                control={editForm.control}
                name="nome_evento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Evento *</FormLabel>
                    <FormControl>
                      <Input placeholder="Inserisci il nome dell'evento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipologia Evento */}
              <FormField
                control={editForm.control}
                name="tipologia_evento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipologia Evento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona la tipologia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Conferenza">Conferenza</SelectItem>
                        <SelectItem value="Workshop">Workshop</SelectItem>
                        <SelectItem value="Seminario">Seminario</SelectItem>
                        <SelectItem value="Incontro">Incontro</SelectItem>
                        <SelectItem value="Manifestazione">Manifestazione</SelectItem>
                        <SelectItem value="Altro">Altro</SelectItem>
                        {isAdmin && (
                          <SelectItem value="Elezioni">Elezioni</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipologia Elezioni - visibile solo se tipologia_evento = "Elezioni" */}
              {watchTipologiaEvento === "Elezioni" && (
                <FormField
                  control={editForm.control}
                  name="tipo_elezione"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipologia Elezioni *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona la tipologia di elezioni" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Europee">Elezioni Europee</SelectItem>
                          <SelectItem value="Politiche_nazionali">Elezioni politiche nazionali (Camera e Senato)</SelectItem>
                          <SelectItem value="Regionali">Elezioni regionali</SelectItem>
                          <SelectItem value="Comunali">Elezioni comunali</SelectItem>
                          <SelectItem value="Referendum">Referendum</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Paese */}
              <FormField
                control={editForm.control}
                name="paese_evento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paese *</FormLabel>
                    <FormControl>
                      <Input placeholder="Italia" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Regione - Solo se NON è "Elezioni" */}
              {watchTipologiaEvento !== "Elezioni" && (
                <FormField
                  control={editForm.control}
                  name="regione_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regione *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona la regione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITALY_DATA?.Italia?.regioni?.map((regione) => (
                            <SelectItem key={regione.nome} value={regione.nome}>
                              {regione.nome}
                            </SelectItem>
                          )) || []}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Provincia - Solo se NON è "Elezioni" */}
              {watchTipologiaEvento !== "Elezioni" && (
                <FormField
                  control={editForm.control}
                  name="provincia_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona la provincia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchTipologiaEvento !== "Elezioni" && editForm.watch("regione_evento") && 
                            ITALY_DATA?.Italia?.regioni
                              ?.find(r => r.nome === editForm.watch("regione_evento"))
                              ?.province?.map((provincia) => (
                                <SelectItem key={provincia.nome} value={provincia.nome}>
                                  {provincia.nome}
                                </SelectItem>
                              )) || []}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Comune - Solo se NON è "Elezioni" */}
              {watchTipologiaEvento !== "Elezioni" && (
                <FormField
                  control={editForm.control}
                  name="comune_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comune *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona il comune" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchTipologiaEvento !== "Elezioni" && editForm.watch("provincia_evento") && 
                            ITALY_DATA?.Italia?.regioni
                              ?.find(r => r.nome === editForm.watch("regione_evento"))
                              ?.province?.find(p => p.nome === editForm.watch("provincia_evento"))
                              ?.comuni?.map((comune) => (
                                <SelectItem key={comune} value={comune}>
                                  {comune}
                                </SelectItem>
                              )) || []}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Indirizzo - Solo se NON è "Elezioni" */}
              {watchTipologiaEvento !== "Elezioni" && (
                <FormField
                  control={editForm.control}
                  name="indirizzo_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indirizzo</FormLabel>
                      <FormControl>
                        <Input placeholder="Inserisci l'indirizzo dell'evento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Giorno di Inizio */}
              <FormField
                control={editForm.control}
                name="giorno_inizio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giorno di Inizio *</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value || ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Giorno di Fine */}
              <FormField
                control={editForm.control}
                name="giorno_fine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giorno di Fine</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value || ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Orario di Inizio/Fine - Solo se NON è "Elezioni" */}
              {watchTipologiaEvento !== "Elezioni" && (
                <>
                  <FormField
                    control={editForm.control}
                    name="orario_inizio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario di Inizio (primo giorno)</FormLabel>
                        <FormControl>
                          <Input type="time" step="60" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="orario_fine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario di Fine (primo giorno)</FormLabel>
                        <FormControl>
                          <Input type="time" step="60" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchGiornoInizio && watchGiornoFine && watchGiornoFine !== watchGiornoInizio && (
                    <>
                      <FormField
                        control={editForm.control}
                        name="orario_inizio_giorno2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Orario di Inizio (secondo giorno)</FormLabel>
                            <FormControl>
                              <Input type="time" step="60" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="orario_fine_giorno2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Orario di Fine (secondo giorno)</FormLabel>
                            <FormControl>
                              <Input type="time" step="60" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </>
              )}

              {/* Pulsanti */}
              <div className="flex gap-4 justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEvent(null);
                  }}
                  disabled={updateEvento.isPending}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={updateEvento.isPending}
                  className="min-w-[200px]"
                >
                  {updateEvento.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aggiornando...
                    </>
                  ) : (
                    "Aggiorna Evento"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
