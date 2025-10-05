import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2, Users, User } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AttivistaModal from "@/components/AttivistaModal";

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
}

interface AttivistiResponse {
  success: boolean;
  data: Attivista[];
  count: number;
  message: string;
}

export default function Attivisti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [attivisti, setAttivisti] = useState<Attivista[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedAttivista, setSelectedAttivista] = useState<Attivista | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          setAttivisti(data.data);
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

  // Pagina pubblica - non richiede autenticazione
  // if (isAuthLoading) {
  //   return (
  //     <PageTransition location="/attivisti" type="fade-up">
  //       <PageContainer>
  //         <div className="flex items-center justify-center min-h-screen">
  //           <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  //         </div>
  //       </PageContainer>
  //     </PageTransition>
  //   );
  // }

  // Redirect se non autenticato - RIMOSSO per rendere la pagina pubblica
  // if (!user) {
  //   return <Redirect to="/auth" />;
  // }

  // Funzione per ottenere le iniziali del nome
  const getInitials = (nome: string, cognome: string) => {
    return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
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

  console.log('🎨 Attivisti render - isLoading:', isLoading, 'isError:', isError, 'attivisti.length:', attivisti.length);
  
  return (
    <PageTransition location="/attivisti" type="fade-up">
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

            {/* Attivisti List */}
            {!isLoading && !isError && attivisti.length > 0 && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Statistiche Attivisti
                      </h2>
                      <p className="text-gray-600">
                        {attivisti.length} attivista{attivisti.length !== 1 ? 'i' : ''} registrato{attivisti.length !== 1 ? 'i' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {attivisti.length}
                      </div>
                      <div className="text-sm text-gray-500">Totale</div>
                    </div>
                  </div>
                </div>

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
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {attivisti.map((attivista) => (
                          <tr key={attivista.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={attivista.avatar_config} />
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                  {getInitials(attivista.nome, attivista.cognome)}
                                </AvatarFallback>
                              </Avatar>
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
    </PageTransition>
  );
}