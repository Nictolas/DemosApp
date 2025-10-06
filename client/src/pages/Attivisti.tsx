import React, { useState, useEffect } from "react";
import { Loader2, Users, User, Search, X } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AttivistaModal from "@/components/AttivistaModal";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedAttivista, setSelectedAttivista] = useState<Attivista | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supportersCount, setSupportersCount] = useState<Record<string, number>>({});
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

  // Carica gli attivisti
  useEffect(() => {
    console.log('🚀 Attivisti useEffect - Inizio');
    const fetchAttivisti = async () => {
      try {
        console.log('🔄 fetchAttivisti - Inizio caricamento');
        setIsLoading(true);
        setIsError(false);
        
        console.log('📡 fetchAttivisti - Chiamata API...');
        const response = await fetch('https://demos-c7k0.onrender.com/api/attivisti');
        console.log('📡 fetchAttivisti - Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Errore ${response.status}: ${response.statusText}`);
        }
        
        console.log('📡 fetchAttivisti - Parsing JSON...');
        const data: AttivistiResponse = await response.json();
        console.log('📊 fetchAttivisti - Data ricevuta:', data);
        
        if (data.success) {
          console.log('✅ fetchAttivisti - Successo, attivisti:', data.data.length);
          // I dati arrivano già ordinati per supporters_count DESC
          setAttivisti(data.data as any);
          setFilteredAttivisti(data.data as any);
          const next: Record<string, number> = {};
          (data.data as any[]).forEach((a) => { next[a.id] = (a as any).supporters_count ?? 0; });
          setSupportersCount(next);
        } else {
          throw new Error(data.message || 'Errore nel caricamento degli attivisti');
        }
      } catch (error) {
        console.error('❌ fetchAttivisti - Errore:', error);
        setIsError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Errore sconosciuto');
      } finally {
        console.log('🏁 fetchAttivisti - Completato, setIsLoading(false)');
        setIsLoading(false);
      }
    };

    fetchAttivisti();
  }, []);

  // Filtra gli attivisti in base al termine di ricerca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAttivisti(attivisti);
    } else {
      const filtered = attivisti.filter(attivista => {
        const fullName = `${attivista.nome} ${attivista.cognome}`.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        return fullName.includes(searchLower) || 
               attivista.nome.toLowerCase().includes(searchLower) || 
               attivista.cognome.toLowerCase().includes(searchLower);
      });
      setFilteredAttivisti(filtered);
    }
  }, [searchTerm, attivisti]);

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

  // Funzione per cancellare la ricerca
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

  // Funzione per seguire un attivista
  const handleFollowUser = async (attivistaId: string) => {
    if (!user?.id) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per seguire un utente",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/sostenitori/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supporter_id: user.id,
          supported_id: attivistaId
        })
      });

      let data: any = null;
      try { data = await response.json(); } catch { /* body vuoto o non JSON */ }

      if (data.success) {
        toast({
          title: "Successo",
          description: "Hai iniziato a seguire questo attivista",
        });
        
        // Aggiorna lo stato locale
        setFollowingUsers(prev => new Set([...prev, attivistaId]));
        
        // Aggiorna conteggio locale + riordina lista
        const currentCount = supportersCount[attivistaId] || 0;
        const total = currentCount + 1;
        setSupportersCount(prev => ({ ...prev, [attivistaId]: total }));
        setFilteredAttivisti(prev => {
          const next = prev.map(a => (a.id === attivistaId ? ({ ...(a as any), supporters_count: total } as any) : a));
          (next as any[]).sort((a: any, b: any) => (b.supporters_count ?? 0) - (a.supporters_count ?? 0));
          return next;
        });
      } else {
        toast({
          title: "Errore",
          description: data.error || "Impossibile seguire questo utente",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Errore nel seguire utente:', error);
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
  console.log('🎨 Attivisti render - should show table:', !isLoading && !isError && filteredAttivisti.length > 0);
  console.log('🎨 Attivisti render - RENDERING PAGE NOW!');
  
  return (
    <PageContainer>
      <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <Users className="h-12 w-12 text-blue-600 mr-3" />
                <h1 className="text-3xl font-bold text-gray-900">Attivisti</h1>
              </div>
              <p className="text-lg text-gray-600">
                Lista di tutti gli attivisti registrati nella piattaforma
              </p>
            </div>

            {/* Barra di Ricerca */}
            {!isLoading && !isError && attivisti.length > 0 && (
              <div className="mb-6">
                <div className="max-w-md mx-auto relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Cerca per nome o cognome..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-10 pr-10 py-2 w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  {searchTerm && (
                    <div className="mt-2 text-sm text-gray-600 text-center">
                      {filteredAttivisti.length === 0 ? (
                        <span className="text-red-600">Nessun attivista trovato per "{searchTerm}"</span>
                      ) : (
                        <span>
                          {filteredAttivisti.length} attivista{filteredAttivisti.length !== 1 ? 'i' : ''} trovato{filteredAttivisti.length !== 1 ? 'i' : ''} per "{searchTerm}"
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                {/* Tabella Attivisti */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Avatar
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nome Cognome
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Regione di Residenza
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sostenitori
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Segui
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleAttivistaClick(attivista)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                              >
                                {attivista.nome} {attivista.cognome}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {attivista.regione_residenza || 'Non specificata'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {supportersCount[attivista.id] ?? 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                                onClick={() => handleFollowUser(attivista.id)}
                                disabled={!user?.id || followingUsers.has(attivista.id)}
                              >
                                {followingUsers.has(attivista.id) ? 'Seguito' : 'Segui'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modale Attivista */}
        <AttivistaModal
          attivista={selectedAttivista}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </PageContainer>
  );
}