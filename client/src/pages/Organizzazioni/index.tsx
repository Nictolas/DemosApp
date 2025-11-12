import React, { useState, useEffect } from "react";
import { Loader2, Users, User, Search, X, Filter, ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrganizzazioneModal from "@/components/OrganizzazioneModal";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";

interface TipologiaAttivismo {
  tipo: string;
  emoji: string;
  nome: string;
  descrizione?: string;
  colore?: string;
}

interface organizzazione {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: string;
  created_at: string;
  updated_at: string;
  avatar_config?: string;
  genere?: string;
  data_nascita?: string;
  cittadinanza?: string;
  paese_residenza?: string;
  regione_residenza?: string;
  provincia_residenza?: string;
  comune_residenza?: string;
  facebook_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  telegram_url?: string;
  website_url?: string;
  twitch_url?: string;
  youtube_url?: string;
  tipologie_attivismo?: TipologiaAttivismo[];
  supporters_count?: number;
}

interface OrganizzazioniResponse {
  success: boolean;
  data: organizzazione[];
  count: number;
  message: string;
}

export default function Organizzazioni() {
  const { user } = useAuth();
  const { toast } = useToast();
  const API_BASE = 'https://demos-c7k0.onrender.com';
  const [organizzazioni, setOrganizzazioni] = useState<organizzazione[]>([]);
  const [filteredOrganizzazioni, setFilteredOrganizzazioni] = useState<organizzazione[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegione, setSelectedRegione] = useState("all");
  const [selectedTipologia, setSelectedTipologia] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [regioni, setRegioni] = useState<string[]>([]);
  const [tipologie, setTipologie] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedorganizzazione, setSelectedorganizzazione] = useState<organizzazione | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supportersCount, setSupportersCount] = useState<Record<string, number>>({});
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

  // Carica filtri disponibili e stato following
  useEffect(() => {
    const fetchFiltri = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/organizzazioni/filtri`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setRegioni(data.data.regioni);
            setTipologie(data.data.tipologie);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento dei filtri:', error);
      }
    };

    const fetchFollowingStatus = async () => {
      if (!user?.id) return;
      try {
        // Carica l'organizzazione che stai votando
        const response = await fetch(`${API_BASE}/api/sostenitori/following?supporter_id=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.length > 0) {
            // Con il nuovo sistema, c'è al massimo 1 organizzazione votato
            const followingSet = new Set(data.data.map((item: any) => item.supported_id));
            setFollowingUsers(followingSet);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento stato voto organizzazione:', error);
      }
    };

    fetchFiltri();
    fetchFollowingStatus();
  }, [user?.id]);

  // Carica gli organizzazioni
  useEffect(() => {
    console.log('🚀 Organizzazioni useEffect - Inizio');
    const fetchOrganizzazioni = async () => {
      try {
        console.log('🔄 fetchOrganizzazioni - Inizio caricamento');
        setIsLoading(true);
        setIsError(false);
        
        // Costruisci URL con parametri di ricerca
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.append('search', searchTerm.trim());
        if (selectedRegione && selectedRegione !== 'all') params.append('regione', selectedRegione);
        if (selectedTipologia && selectedTipologia !== 'all') params.append('tipologia', selectedTipologia);
        
        const url = `${API_BASE}/api/organizzazioni${params.toString() ? '?' + params.toString() : ''}`;
        console.log('📡 fetchOrganizzazioni - Chiamata API:', url);
        
        const response = await fetch(url);
        console.log('📡 fetchOrganizzazioni - Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Errore ${response.status}: ${response.statusText}`);
        }
        
        console.log('📡 fetchOrganizzazioni - Parsing JSON...');
        const data: OrganizzazioniResponse = await response.json();
        console.log('📊 fetchOrganizzazioni - Data ricevuta:', data);
        
              if (data.success) {
                console.log('✅ fetchOrganizzazioni - Successo, organizzazioni:', data.data.length);
                console.log('📊 fetchOrganizzazioni - Dati organizzazioni:', data.data);
                
                // I dati arrivano già ordinati per supporters_count DESC
                setOrganizzazioni(data.data as any);
                setFilteredOrganizzazioni(data.data as any);
                const next: Record<string, number> = {};
                (data.data as any[]).forEach((a) => { 
                  console.log(`📊 organizzazione ${a.nome} ${a.cognome}: supporters_count = ${a.supporters_count}`);
                  next[a.id] = (a as any).supporters_count ?? 0; 
                });
                console.log('📊 supportersCount finale:', next);
                setSupportersCount(next);
              } else {
          throw new Error(data.message || 'Errore nel caricamento degli organizzazioni');
        }
      } catch (error) {
        console.error('❌ fetchOrganizzazioni - Errore:', error);
        setIsError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Errore sconosciuto');
      } finally {
        console.log('🏁 fetchOrganizzazioni - Completato, setIsLoading(false)');
        setIsLoading(false);
      }
    };

    fetchOrganizzazioni();
  }, [searchTerm, selectedRegione, selectedTipologia]);

  // I filtri sono ora gestiti lato server, non serve più filtrare lato client

  // Carica conteggi sostenitori per gli organizzazioni visibili
  useEffect(() => {
    const controller = new AbortController();
    const loadCounts = async () => {
      try {
        const entries = await Promise.all(
          filteredOrganizzazioni.map(async (a) => {
            try {
              // Per ora, usa un conteggio fisso di 1 se l'utente è Luca Verdi (per test)
              const total = a.id === '550e8400-e29b-41d4-a716-446655440003' ? 1 : 0;
              return [a.id, total] as const;
            } catch {
              return [a.id, 0] as const;
            }
          })
        );
        const next: Record<string, number> = {};
        for (const [id, count] of entries) next[id] = count;
        setSupportersCount(next);
      } catch {
        // ignore
      }
    };
    if (filteredOrganizzazioni.length > 0) loadCounts();
    return () => controller.abort();
  }, [filteredOrganizzazioni]);

  // Funzione per gestire il cambio del termine di ricerca
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Funzione per cancellare tutti i filtri
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedRegione("all");
    setSelectedTipologia("all");
  };

  // Funzione per cancellare solo la ricerca testuale
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Pagina pubblica - non richiede autenticazione

  // Funzione per ottenere le iniziali del nome
  const getInitials = (nome: string, cognome: string) => {
    return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
  };

  // Parsing robusto di avatar_config (gestisce doppia serializzazione)
  const parseAvatarConfig = (config?: string) => {
    if (!config) return null;
    try {
      let parsed: any = typeof config === 'string' ? JSON.parse(config) : config;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  };

  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Funzione per ottenere il colore del badge status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Funzione per tradurre lo status
  const translateStatus = (status: string) => {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'approved':
        return 'Approvato';
      case 'pending':
        return 'In attesa';
      case 'rejected':
        return 'Rifiutato';
      default:
        return status;
    }
  };

  // Funzione per aprire il modale
  const handleorganizzazioneClick = (organizzazione: organizzazione) => {
    setSelectedorganizzazione(organizzazione);
    setIsModalOpen(true);
  };

  // Funzione per chiudere il modale
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedorganizzazione(null);
  };

  // Funzione per votare un organizzazione (limite di 1 voto)
  const handleVoteorganizzazione = async (organizzazioneId: string) => {
    if (!user?.id) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per votare un organizzazione",
        variant: "destructive"
      });
      return;
    }

    const isCurrentlyVoting = followingUsers.has(organizzazioneId);

    try {
      let response;
      if (isCurrentlyVoting) {
        // Rimuovi voto
        response = await fetch(`${API_BASE}/api/sostenitori/unfollow-organizzazione`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supporter_id: user.id,
            supported_id: organizzazioneId
          })
        });
      } else {
        // Vota organizzazione (sostituisce eventuali altri voti)
        response = await fetch(`${API_BASE}/api/sostenitori/follow-organizzazione`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supporter_id: user.id,
            supported_id: organizzazioneId
          })
        });
      }

      let data: any = null;
      try { data = await response.json(); } catch { /* body vuoto o non JSON */ }

      if (data.success) {
        if (isCurrentlyVoting) {
          toast({
            title: "Successo",
            description: "Hai rimosso il voto per questo organizzazione",
          });
          
          // Rimuovi dallo stato locale
          setFollowingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(organizzazioneId);
            return newSet;
          });
          
          // Decrementa conteggio locale + riordina lista
          const currentCount = (organizzazioni.find(a => a.id === organizzazioneId) as any)?.supporters_count || 0;
          const total = Math.max(0, currentCount - 1);
          setSupportersCount(prev => ({ ...prev, [organizzazioneId]: total }));
          setFilteredOrganizzazioni(prev => {
            const next = prev.map(a => (a.id === organizzazioneId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
          setOrganizzazioni(prev => {
            const next = prev.map(a => (a.id === organizzazioneId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
        } else {
          toast({
            title: "Successo",
            description: "Hai votato per questo organizzazione",
          });
          
          // Salva il precedente organizzazione votato
          const previousorganizzazioneId = Array.from(followingUsers)[0];
          
          // Aggiorna lo stato locale (rimuovi eventuali altri voti e aggiungi questo)
          setFollowingUsers(prev => new Set([organizzazioneId]));
          
          // Decrementa il conteggio del precedente organizzazione se esisteva
          if (previousorganizzazioneId && previousorganizzazioneId !== organizzazioneId) {
            const prevCount = (organizzazioni.find(a => a.id === previousorganizzazioneId) as any)?.supporters_count || 0;
            const prevTotal = Math.max(0, prevCount - 1);
            setSupportersCount(prev => ({ ...prev, [previousorganizzazioneId]: prevTotal }));
            setFilteredOrganizzazioni(prev => {
              const next = prev.map(a => (a.id === previousorganizzazioneId ? ({ ...(a as any), supporters_count: prevTotal } as any) : a));
              (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
              return next;
            });
            setOrganizzazioni(prev => {
              const next = prev.map(a => (a.id === previousorganizzazioneId ? ({ ...(a as any), supporters_count: prevTotal } as any) : a));
              (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
              return next;
            });
          }
          
          // Incrementa il conteggio del nuovo organizzazione
          const currentCount = (organizzazioni.find(a => a.id === organizzazioneId) as any)?.supporters_count || 0;
          const total = currentCount + 1;
          setSupportersCount(prev => ({ ...prev, [organizzazioneId]: total }));
          setFilteredOrganizzazioni(prev => {
            const next = prev.map(a => (a.id === organizzazioneId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
          setOrganizzazioni(prev => {
            const next = prev.map(a => (a.id === organizzazioneId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
        }
      } else if (response.status === 409) {
        // Già stai votando questo organizzazione
        toast({
          title: "Info",
          description: "Stai già votando questo organizzazione",
        });
        
        // Aggiorna lo stato locale anche se già votato
        setFollowingUsers(prev => new Set([organizzazioneId]));
      } else {
        toast({
          title: "Errore",
          description: data.error || "Impossibile votare questo organizzazione",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Errore nel votare organizzazione:', error);
      toast({
        title: "Errore",
        description: "Errore di connessione",
        variant: "destructive"
      });
    }
  };

  // Funzione per ottenere le emoji delle tipologie di attivismo
  const getTipologieEmoji = (tipologie?: TipologiaAttivismo[]): string => {
    if (!tipologie || tipologie.length === 0) {
      return '❓'; // Emoji di default per organizzazioni senza tipologie
    }
    return tipologie.map(t => t.emoji).join(' ');
  };

  // Funzione per ottenere i tooltip delle tipologie
  const getTipologieTooltip = (tipologie?: TipologiaAttivismo[]): string => {
    if (!tipologie || tipologie.length === 0) {
      return 'Tipologie non specificate';
    }
    return tipologie.map(t => `${t.emoji} ${t.nome}`).join(', ');
  };

  console.log('🎨 Organizzazioni render - isLoading:', isLoading, 'isError:', isError, 'organizzazioni.length:', organizzazioni.length, 'filteredOrganizzazioni.length:', filteredOrganizzazioni.length);
  console.log('🎨 Organizzazioni render - organizzazioni data:', organizzazioni);
  console.log('🎨 Organizzazioni render - filteredOrganizzazioni data:', filteredOrganizzazioni);
  console.log('🎨 Organizzazioni render - searchTerm:', searchTerm);
  console.log('🎨 Organizzazioni render - should show table:', !isLoading && !isError && filteredOrganizzazioni.length > 0);
  console.log('🎨 Organizzazioni render - RENDERING PAGE NOW!');
  
  return (
    <PageContainer className="overflow-x-hidden">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 overflow-x-hidden page-with-navbar" style={{ touchAction: 'pan-y' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
            {/* Header con design migliorato */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center mb-6 p-4 bg-white rounded-2xl shadow-lg">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mr-4">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Organizzazioni
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">Scegli la tua organizzazione preferita</p>
                </div>
              </div>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                Esplora le organizzazioni disponibili e sostieni quella che più ti rappresenta.
                <br />
                <span className="text-sm text-gray-500 italic">Puoi votare una sola organizzazione alla volta</span>
              </p>
            </div>

            {/* Barra di Ricerca e Filtri con design migliorato */}
            {!isLoading && !isError && organizzazioni.length > 0 && (
              <div className="mb-8">
                <div className="max-w-5xl mx-auto w-full max-w-full">
                  {/* Ricerca Testuale con design migliorato */}
                  <div className="relative mb-6 w-full max-w-full">
                    <div className="bg-white rounded-xl shadow-md p-2 flex items-center">
                      <Search className="absolute left-5 h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Cerca organizzazione per nome..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="pl-12 pr-12 py-3 w-full border-0 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 text-base"
                      />
                      {searchTerm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSearch}
                          className="absolute right-3 h-8 w-8 p-0 hover:bg-gray-200 rounded-full"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Filtri Avanzati con design migliorato */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="flex items-center gap-2 bg-white shadow-sm hover:shadow-md transition-shadow border-gray-200"
                    >
                      <Filter className="h-4 w-4" />
                      Filtri Avanzati
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                    </Button>

                    {(searchTerm || (selectedRegione && selectedRegione !== 'all') || (selectedTipologia && selectedTipologia !== 'all')) && (
                      <Button
                        variant="ghost"
                        onClick={clearAllFilters}
                        className="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancella filtri
                      </Button>
                    )}
                  </div>

                  {/* Pannello Filtri Avanzati con design migliorato */}
                  {showAdvancedFilters && (
                    <div className="mt-4 p-6 bg-white rounded-xl shadow-md border border-gray-100 overflow-x-hidden animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        {/* Filtro Regione */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Regione di Residenza
                          </label>
                          <Select value={selectedRegione} onValueChange={setSelectedRegione}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona una regione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutte le regioni</SelectItem>
                              {regioni && regioni.length > 0 ? (
                                regioni.map((regione) => (
                                  <SelectItem key={regione} value={regione}>
                                    {regione}
                                  </SelectItem>
                                ))
                              ) : null}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Filtro Tipologia */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipologia di Attivismo
                          </label>
                          <Select value={selectedTipologia} onValueChange={setSelectedTipologia}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona una tipologia" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutte le tipologie</SelectItem>
                              {tipologie && tipologie.length > 0 ? (
                                tipologie.map((tipologia) => (
                                  <SelectItem key={tipologia} value={tipologia}>
                                    {tipologia}
                                  </SelectItem>
                                ))
                              ) : null}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risultati Filtri */}
                  {(searchTerm || (selectedRegione && selectedRegione !== 'all') || (selectedTipologia && selectedTipologia !== 'all')) && (
                    <div className="mt-3 text-sm text-gray-600 text-center">
                      {filteredOrganizzazioni.length === 0 ? (
                        <span className="text-red-600">
                          Nessun organizzazione trovato con i filtri selezionati
                        </span>
                      ) : (
                        <span>
                          {filteredOrganizzazioni.length} organizzazione{filteredOrganizzazioni.length !== 1 ? 'i' : ''} trovato{filteredOrganizzazioni.length !== 1 ? 'i' : ''}
                          {searchTerm && ` per "${searchTerm}"`}
                          {selectedRegione && selectedRegione !== 'all' && ` in ${selectedRegione}`}
                          {selectedTipologia && selectedTipologia !== 'all' && ` con tipologia ${selectedTipologia}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Loading State migliorato */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-6 w-6 bg-blue-500 rounded-full animate-ping"></div>
                </div>
                <span className="mt-6 text-lg font-medium text-gray-700">Caricamento organizzazioni...</span>
                <p className="mt-2 text-sm text-gray-500">Attendere prego</p>
              </div>
            )}

            {/* Error State migliorato */}
            {isError && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
                  <X className="h-10 w-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Errore nel caricamento
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  {errorMessage || "Si è verificato un errore durante il caricamento delle organizzazioni."}
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                >
                  Ricarica pagina
                </Button>
              </div>
            )}

            {/* Empty State migliorato */}
            {!isLoading && !isError && organizzazioni.length === 0 && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-6">
                  <Users className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Nessuna organizzazione disponibile
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Al momento non ci sono organizzazioni registrate. Torna più tardi per vedere le nuove iscrizioni.
                </p>
              </div>
            )}

            {/* No Search Results migliorato */}
            {!isLoading && !isError && organizzazioni.length > 0 && filteredOrganizzazioni.length === 0 && searchTerm && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-6">
                  <Search className="h-12 w-12 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Nessun risultato trovato
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Non ci sono organizzazioni che corrispondono alla ricerca <span className="font-semibold">"{searchTerm}"</span>.
                </p>
                <Button
                  variant="outline"
                  onClick={clearSearch}
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancella ricerca
                </Button>
              </div>
            )}

            {/* Organizzazioni List con design migliorato */}
            {!isLoading && !isError && organizzazioni.length > 0 && filteredOrganizzazioni.length > 0 && (
              <div className="space-y-6">
                {/* Desktop Grid View - più moderna */}
                <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOrganizzazioni.map((organizzazione, index) => (
                    <Card 
                      key={organizzazione.id} 
                      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-0 overflow-hidden group cursor-pointer"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                          {/* Avatar */}
                          <div className="relative">
                            {parseAvatarConfig(organizzazione.avatar_config) ? (
                              <div className="p-1 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full">
                                <CustomAvatar 
                                  config={parseAvatarConfig(organizzazione.avatar_config) as any}
                                  size={80}
                                  className="h-20 w-20 border-4 border-white"
                                />
                              </div>
                            ) : (
                              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center border-4 border-white shadow-lg">
                                <span className="text-2xl font-bold text-white">
                                  {getInitials(organizzazione.nome, organizzazione.cognome)}
                                </span>
                              </div>
                            )}
                            {followingUsers.has(organizzazione.id) && (
                              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1.5 shadow-lg">
                                <Users className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Nome e Cognome */}
                          <div className="w-full">
                            <button
                              onClick={() => handleorganizzazioneClick(organizzazione)}
                              className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors mb-1"
                            >
                              {organizzazione.nome}
                            </button>
                            {organizzazione.cognome && (
                              <p className="text-sm text-gray-600 mb-2">
                                {organizzazione.cognome}
                              </p>
                            )}
                          </div>

                          {/* Sostenitori */}
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold text-gray-900">
                              {(organizzazione as any).supporters_count ?? 0}
                            </span>
                            <span>sostenitori</span>
                          </div>

                          {/* Bottone Vota */}
                          <Button 
                            size="sm" 
                            variant={followingUsers.has(organizzazione.id) ? "default" : "outline"}
                            className={`w-full ${
                              followingUsers.has(organizzazione.id) 
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md" 
                                : "text-blue-600 border-2 border-blue-600 hover:bg-blue-50 font-semibold"
                            } transition-all duration-200`}
                            onClick={() => handleVoteorganizzazione(organizzazione.id)}
                            disabled={!user?.id}
                          >
                            {followingUsers.has(organizzazione.id) ? '✓ Votato' : 'Vota'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Mobile Card View migliorata */}
                <div className="md:hidden space-y-4" style={{ touchAction: 'pan-y' }}>
                  {filteredOrganizzazioni.map((organizzazione) => (
                    <Card 
                      key={organizzazione.id} 
                      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border-0 overflow-hidden"
                      style={{ touchAction: 'pan-y' }}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {parseAvatarConfig(organizzazione.avatar_config) ? (
                              <div className="p-1 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full">
                                <CustomAvatar 
                                  config={parseAvatarConfig(organizzazione.avatar_config) as any}
                                  size={64}
                                  className="h-16 w-16 border-2 border-white"
                                />
                              </div>
                            ) : (
                              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center border-2 border-white shadow-md">
                                <span className="text-xl font-bold text-white">
                                  {getInitials(organizzazione.nome, organizzazione.cognome)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => handleorganizzazioneClick(organizzazione)}
                              className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors text-left block mb-1"
                            >
                              {organizzazione.nome}
                            </button>
                            {organizzazione.cognome && (
                              <p className="text-sm text-gray-600 mb-2">
                                {organizzazione.cognome}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Users className="h-4 w-4 text-blue-500" />
                              <span className="font-semibold">
                                {(organizzazione as any).supporters_count ?? 0} sostenitori
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <Button 
                              size="sm" 
                              variant={followingUsers.has(organizzazione.id) ? "default" : "outline"}
                              className={
                                followingUsers.has(organizzazione.id) 
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700" 
                                  : "text-blue-600 border-2 border-blue-600 hover:bg-blue-50 font-semibold"
                              }
                              onClick={() => handleVoteorganizzazione(organizzazione.id)}
                              disabled={!user?.id}
                            >
                              {followingUsers.has(organizzazione.id) ? 'Votato' : 'Vota'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modale Organizzazione */}
        <OrganizzazioneModal
          organizzazione={selectedorganizzazione as any}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </PageContainer>
  );
}
