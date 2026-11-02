import React, { useState, useEffect } from "react";
import { Loader2, Users, User, Search, X, Filter, ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { ProposeSubjectButton } from "@/components/ProposeSubjectButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AttivistaModal from "@/components/AttivistaModal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TipologiaAttivismo {
  tipo: string;
  emoji: string;
  nome: string;
  descrizione?: string;
  colore?: string;
}

interface Attivista {
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

interface AttivistiResponse {
  success: boolean;
  data: Attivista[];
  count: number;
  message: string;
}

export default function Attivisti() {
  const { user } = useAuth();
  const { toast } = useToast();
  const API_BASE = 'https://demos-c7k0.onrender.com';
  const [attivisti, setAttivisti] = useState<Attivista[]>([]);
  const [filteredAttivisti, setFilteredAttivisti] = useState<Attivista[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegione, setSelectedRegione] = useState("all");
  const [selectedTipologia, setSelectedTipologia] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [regioni, setRegioni] = useState<string[]>([]);
  const [tipologie, setTipologie] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedAttivista, setSelectedAttivista] = useState<Attivista | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supportersCount, setSupportersCount] = useState<Record<string, number>>({});
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

  // Carica filtri disponibili e stato following
  useEffect(() => {
    const fetchFiltri = async () => {
      try {
        console.log('🔍 fetchFiltri - Chiamata API filtri attivisti');
        const response = await fetch(`${API_BASE}/api/attivisti/filtri`);
        console.log('🔍 fetchFiltri - Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 fetchFiltri - Data ricevuta:', data);
          
          if (data.success) {
            console.log('✅ fetchFiltri - Successo, regioni:', data.data.regioni.length, 'tipologie:', data.data.tipologie.length);
            setRegioni(data.data.regioni);
            setTipologie(data.data.tipologie);
          } else {
            console.error('❌ fetchFiltri - API success=false:', data);
          }
        } else {
          console.error('❌ fetchFiltri - Response not ok:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ fetchFiltri - Errore:', error);
      }
    };

    const fetchFollowingStatus = async () => {
      if (!user?.id) return;
      try {
        // Lo stato di voto è derivato esclusivamente dall'utente autenticato.
        const response = await apiRequest("GET", "/api/sostenitori/following");
        const data = response.data;
        if (data?.success && data.data.length > 0) {
          const followingSet = new Set<string>(data.data.map((item: any) => item.supported_id));
          setFollowingUsers(followingSet);
        } else {
          setFollowingUsers(new Set());
        }
      } catch (error) {
        console.error('Errore nel caricamento stato voto attivista:', error);
      }
    };

    // Carica sempre i filtri (pagina pubblica)
    fetchFiltri();
    
    // Carica stato following solo se autenticato
    if (user?.id) {
      fetchFollowingStatus();
    }
  }, [user?.id]);

  // Carica gli attivisti
  useEffect(() => {
    const controller = new AbortController();
    console.log('🚀 Attivisti useEffect - Inizio');
    const fetchAttivisti = async () => {
      try {
        console.log('🔄 fetchAttivisti - Inizio caricamento');
        setIsLoading(true);
        setIsError(false);
        
        // Costruisci URL con parametri di ricerca
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.append('search', searchTerm.trim());
        if (selectedRegione && selectedRegione !== 'all') params.append('regione', selectedRegione);
        if (selectedTipologia && selectedTipologia !== 'all') params.append('tipologia', selectedTipologia);
        
        const url = `${API_BASE}/api/attivisti${params.toString() ? '?' + params.toString() : ''}`;
        console.log('📡 fetchAttivisti - Chiamata API:', url);
        
        const response = await fetch(url, { signal: controller.signal });
        console.log('📡 fetchAttivisti - Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Errore ${response.status}: ${response.statusText}`);
        }
        
        console.log('📡 fetchAttivisti - Parsing JSON...');
        const data: AttivistiResponse = await response.json();
        // Una ricerca precedente non deve sovrascrivere i risultati dell'ultima digitazione.
        if (controller.signal.aborted) return;
        console.log('📊 fetchAttivisti - Data ricevuta:', data);
        
              if (data.success) {
                console.log('✅ fetchAttivisti - Successo, attivisti:', data.data.length);
                console.log('📊 fetchAttivisti - Dati attivisti:', data.data);
                
                // I dati arrivano già ordinati per supporters_count DESC
                setAttivisti(data.data as any);
                setFilteredAttivisti(data.data as any);
                const next: Record<string, number> = {};
                (data.data as any[]).forEach((a) => { 
                  console.log(`📊 Attivista ${a.nome} ${a.cognome}: supporters_count = ${a.supporters_count}`);
                  next[a.id] = (a as any).supporters_count ?? 0; 
                });
                console.log('📊 supportersCount finale:', next);
                setSupportersCount(next);
              } else {
          throw new Error(data.message || 'Errore nel caricamento degli attivisti');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('❌ fetchAttivisti - Errore:', error);
        setIsError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Errore sconosciuto');
      } finally {
        console.log('🏁 fetchAttivisti - Completato, setIsLoading(false)');
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    // Non interrogare il backend per ogni singola lettera.
    const timer = window.setTimeout(() => {
      void fetchAttivisti();
    }, searchTerm.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, selectedRegione, selectedTipologia]);

  // I filtri sono ora gestiti lato server, non serve più filtrare lato client

  // Carica conteggi sostenitori per gli attivisti visibili
  useEffect(() => {
    const controller = new AbortController();
    const loadCounts = async () => {
      try {
        const entries = await Promise.all(
          filteredAttivisti.map(async (a) => {
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
    if (filteredAttivisti.length > 0) loadCounts();
    return () => controller.abort();
  }, [filteredAttivisti]);

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
  const handleAttivistaClick = (attivista: Attivista) => {
    setSelectedAttivista(attivista);
    setIsModalOpen(true);
  };

  // Funzione per chiudere il modale
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAttivista(null);
  };

  // Funzione per votare un attivista (limite di 1 voto)
  const handleVoteAttivista = async (attivistaId: string) => {
    if (!user?.id) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per votare un attivista",
        variant: "destructive"
      });
      return;
    }

    const isCurrentlyVoting = followingUsers.has(attivistaId);

    try {
      const response = isCurrentlyVoting
        ? await apiRequest("DELETE", "/api/sostenitori/unfollow", { supported_id: attivistaId })
        : await apiRequest("POST", "/api/sostenitori/follow", { supported_id: attivistaId });

      const data: any = response.data;

      if (data.success) {
        if (isCurrentlyVoting) {
          toast({
            title: "Successo",
            description: "Hai rimosso il voto per questo attivista",
          });
          
          // Rimuovi dallo stato locale
          setFollowingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(attivistaId);
            return newSet;
          });
          
          // Decrementa conteggio locale + riordina lista
          const currentCount = (attivisti.find(a => a.id === attivistaId) as any)?.supporters_count || 0;
          const total = Math.max(0, currentCount - 1);
          setSupportersCount(prev => ({ ...prev, [attivistaId]: total }));
          setFilteredAttivisti(prev => {
            const next = prev.map(a => (a.id === attivistaId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
          setAttivisti(prev => {
            const next = prev.map(a => (a.id === attivistaId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
        } else {
          toast({
            title: "Successo",
            description: "Hai votato per questo attivista",
          });
          
          // Salva il precedente attivista votato
          const previousAttivistaId = Array.from(followingUsers)[0];
          
          // Aggiorna lo stato locale (rimuovi eventuali altri voti e aggiungi questo)
          setFollowingUsers(prev => new Set([attivistaId]));
          
          // Decrementa il conteggio del precedente attivista se esisteva
          if (previousAttivistaId && previousAttivistaId !== attivistaId) {
            const prevCount = (attivisti.find(a => a.id === previousAttivistaId) as any)?.supporters_count || 0;
            const prevTotal = Math.max(0, prevCount - 1);
            setSupportersCount(prev => ({ ...prev, [previousAttivistaId]: prevTotal }));
            setFilteredAttivisti(prev => {
              const next = prev.map(a => (a.id === previousAttivistaId ? ({ ...(a as any), supporters_count: prevTotal } as any) : a));
              (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
              return next;
            });
            setAttivisti(prev => {
              const next = prev.map(a => (a.id === previousAttivistaId ? ({ ...(a as any), supporters_count: prevTotal } as any) : a));
              (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
              return next;
            });
          }
          
          // Incrementa il conteggio del nuovo attivista
          const currentCount = (attivisti.find(a => a.id === attivistaId) as any)?.supporters_count || 0;
          const total = currentCount + 1;
          setSupportersCount(prev => ({ ...prev, [attivistaId]: total }));
          setFilteredAttivisti(prev => {
            const next = prev.map(a => (a.id === attivistaId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
          setAttivisti(prev => {
            const next = prev.map(a => (a.id === attivistaId ? ({ ...(a as any), supporters_count: total } as any) : a));
            (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
            return next;
          });
        }
      } else if (response.status === 409) {
        // Già stai votando questo attivista
        toast({
          title: "Info",
          description: "Stai già votando questo attivista",
        });
        
        // Aggiorna lo stato locale anche se già votato
        setFollowingUsers(prev => new Set([attivistaId]));
      } else {
        toast({
          title: "Errore",
          description: data.error || "Impossibile votare questo attivista",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      if (error?.status === 409) {
        toast({
          title: "Info",
          description: "Stai già votando questo attivista",
        });
        setFollowingUsers(new Set([attivistaId]));
        return;
      }
      console.error('Errore nel votare attivista:', error);
      toast({
        title: "Errore",
        description: error?.message || "Errore di connessione",
        variant: "destructive"
      });
    }
  };

  // Funzione per ottenere le emoji delle tipologie di attivismo
  const getTipologieEmoji = (tipologie?: TipologiaAttivismo[]): string => {
    if (!tipologie || tipologie.length === 0) {
      return '❓'; // Emoji di default per attivisti senza tipologie
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

  console.log('🎨 Attivisti render - isLoading:', isLoading, 'isError:', isError, 'attivisti.length:', attivisti.length, 'filteredAttivisti.length:', filteredAttivisti.length);
  console.log('🎨 Attivisti render - attivisti data:', attivisti);
  console.log('🎨 Attivisti render - filteredAttivisti data:', filteredAttivisti);
  console.log('🎨 Attivisti render - searchTerm:', searchTerm);
  console.log('🎨 Attivisti render - regioni disponibili:', regioni.length, regioni);
  console.log('🎨 Attivisti render - tipologie disponibili:', tipologie.length, tipologie);
  console.log('🎨 Attivisti render - should show table:', !isLoading && !isError && filteredAttivisti.length > 0);
  console.log('🎨 Attivisti render - RENDERING PAGE NOW!');
  
  return (
    <PageContainer className="directory-attivisti-page overflow-hidden bg-gray-50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-3 sm:px-6 sm:pt-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
            {/* Header */}
            <div className="relative mb-3 text-center">
              <div className="absolute right-0 top-0 z-10"><ProposeSubjectButton category="attivisti" /></div>
              <div className="flex items-center justify-center mb-2">
                <Users className="h-8 w-8 text-blue-600 mr-2" />
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Attivisti</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Scegli il tuo Attivista preferito.
                <br />
                <span className="text-sm text-gray-500">(In futuro sarà possibile scegliere più attivisti.)</span>
              </p>
            </div>

            {/* Barra di Ricerca e Filtri: resta montata anche mentre arrivano i risultati. */}
              <div className="mt-3">
                <div className="max-w-4xl mx-auto w-full max-w-full">
                  {/* Ricerca Testuale */}
                  <div className="relative mb-2 w-full max-w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Cerca per nome o cognome..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-10 pr-10 py-2 w-full max-w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                  </div>

                  {/* Filtri Avanzati */}
                  <div className="flex flex-wrap gap-2 items-center justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="flex items-center gap-2"
                    >
                      <Filter className="h-4 w-4" />
                      Filtri Avanzati
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                    </Button>

                    {(searchTerm || (selectedRegione && selectedRegione !== 'all') || (selectedTipologia && selectedTipologia !== 'all')) && (
                      <Button
                        variant="ghost"
                        onClick={clearAllFilters}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancella tutti i filtri
                      </Button>
                    )}
                  </div>

                  {/* Pannello Filtri Avanzati */}
                  {showAdvancedFilters && (
                    <div className="mt-2 max-h-[25dvh] overflow-y-auto overscroll-contain rounded-lg border bg-gray-50 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
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
                              {regioni.map((regione) => (
                                <SelectItem key={regione} value={regione}>
                                  {regione}
                                </SelectItem>
                              ))}
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
                              {tipologie.map((tipologia) => (
                                <SelectItem key={tipologia} value={tipologia}>
                                  {tipologia}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risultati Filtri */}
                  {(searchTerm || (selectedRegione && selectedRegione !== 'all') || (selectedTipologia && selectedTipologia !== 'all')) && (
                    <div className="mt-3 text-sm text-gray-600 text-center">
                      {filteredAttivisti.length === 0 ? (
                        <span className="text-red-600">
                          Nessun attivista trovato con i filtri selezionati
                        </span>
                      ) : (
                        <span>
                          {filteredAttivisti.length} attivista{filteredAttivisti.length !== 1 ? 'i' : ''} trovato{filteredAttivisti.length !== 1 ? 'i' : ''}
                          {searchTerm && ` per "${searchTerm}"`}
                          {selectedRegione && selectedRegione !== 'all' && ` in ${selectedRegione}`}
                          {selectedTipologia && selectedTipologia !== 'all' && ` con tipologia ${selectedTipologia}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

          </div>
        </div>

        {/* Intestazione e controlli rimangono fissi; scorre solo la lista. */}
        <section
          className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 sm:px-6 sm:pb-6"
          role="region"
          aria-label="Elenco attivisti"
          tabIndex={0}
        >
          <div className="mx-auto w-full max-w-6xl">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Caricamento attivisti...</span>
              </div>
            )}

            {/* Error State */}
            {isError && (
              <div className="text-center py-16">
                <div className="text-red-500 text-lg mb-4">
                  Errore nel caricamento degli attivisti
                </div>
                <div className="text-gray-600">
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && attivisti.length === 0 && (
              <div className="text-center py-16">
                <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Al momento non ci sono attivisti
                </h3>
                <p className="text-gray-600">
                  La lista degli attivisti è vuota. Torna più tardi per vedere i nuovi iscritti.
                </p>
              </div>
            )}

            {/* No Search Results */}
            {!isLoading && !isError && attivisti.length > 0 && filteredAttivisti.length === 0 && searchTerm && (
              <div className="text-center py-16">
                <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Nessun risultato trovato
                </h3>
                <p className="text-gray-600 mb-4">
                  Non ci sono attivisti che corrispondono alla ricerca "{searchTerm}".
                </p>
                <Button
                  variant="outline"
                  onClick={clearSearch}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Cancella ricerca
                </Button>
              </div>
            )}

            {/* Attivisti List */}
            {!isLoading && !isError && attivisti.length > 0 && filteredAttivisti.length > 0 && (
              <div className="space-y-6">
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full divide-y divide-gray-200 min-w-0">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Avatar
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nome
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sostenitori
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Azione
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAttivisti.map((attivista) => (
                          <tr key={attivista.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              {parseAvatarConfig(attivista.avatar_config) ? (
                                <CustomAvatar 
                                  config={parseAvatarConfig(attivista.avatar_config) as any}
                                  size={40}
                                  className="h-10 w-10"
                                />
                              ) : (
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-blue-100 text-blue-600">
                                    {getInitials(attivista.nome, attivista.cognome)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-0">
                              <button
                                onClick={() => handleAttivistaClick(attivista)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors truncate max-w-xs"
                                title={`${attivista.nome} ${attivista.cognome}`}
                              >
                                {attivista.nome} {attivista.cognome}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {(attivista as any).supporters_count ?? 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Button 
                                size="sm" 
                                variant={followingUsers.has(attivista.id) ? "default" : "outline"}
                                className={followingUsers.has(attivista.id) 
                                  ? "bg-blue-600 text-white hover:bg-blue-700" 
                                  : "text-blue-600 border-blue-600 hover:bg-blue-50"}
                                onClick={() => handleVoteAttivista(attivista.id)}
                                disabled={!user?.id}
                              >
                                {followingUsers.has(attivista.id) ? 'Votato' : 'Vota'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4" style={{ touchAction: 'pan-y' }}>
                  {filteredAttivisti.map((attivista) => (
                    <div key={attivista.id} className="bg-white rounded-lg shadow p-4" style={{ touchAction: 'pan-y' }}>
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {parseAvatarConfig(attivista.avatar_config) ? (
                            <CustomAvatar 
                              config={parseAvatarConfig(attivista.avatar_config) as any}
                              size={48}
                              className="h-12 w-12"
                            />
                          ) : (
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                                {getInitials(attivista.nome, attivista.cognome)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => handleAttivistaClick(attivista)}
                            className="text-base font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors text-left"
                          >
                            {attivista.nome} {attivista.cognome}
                          </button>
                          <div className="mt-1 text-sm text-gray-500">
                            {(attivista as any).supporters_count ?? 0} sostenitori
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Button 
                            size="sm" 
                            variant={followingUsers.has(attivista.id) ? "default" : "outline"}
                            className={followingUsers.has(attivista.id) 
                              ? "bg-blue-600 text-white hover:bg-blue-700" 
                              : "text-blue-600 border-blue-600 hover:bg-blue-50"}
                            onClick={() => handleVoteAttivista(attivista.id)}
                            disabled={!user?.id}
                          >
                            {followingUsers.has(attivista.id) ? 'Votato' : 'Vota'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Modale Attivista */}
        <AttivistaModal
          attivista={selectedAttivista}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </PageContainer>
  );
}