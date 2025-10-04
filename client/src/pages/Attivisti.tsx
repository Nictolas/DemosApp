import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2, Users, User } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  // Carica gli attivisti
  useEffect(() => {
    const fetchAttivisti = async () => {
      try {
        setIsLoading(true);
        setIsError(false);
        
        const response = await fetch('https://demos-c7k0.onrender.com/api/attivisti');
        if (!response.ok) {
          throw new Error(`Errore ${response.status}: ${response.statusText}`);
        }
        
        const data: AttivistiResponse = await response.json();
        
        if (data.success) {
          setAttivisti(data.data);
        } else {
          throw new Error(data.message || 'Errore nel caricamento degli attivisti');
        }
      } catch (error) {
        console.error('Errore nel caricamento degli attivisti:', error);
        setIsError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Errore sconosciuto');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchAttivisti();
    }
  }, [user]);

  // Mostra loading durante l'autenticazione
  if (isAuthLoading) {
    return (
      <PageTransition location="/attivisti" type="fade-up">
        <PageContainer>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
        </PageContainer>
      </PageTransition>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

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

                {/* Attivisti Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {attivisti.map((attivista) => (
                    <Card key={attivista.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-4">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={attivista.avatar_config} />
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {getInitials(attivista.nome, attivista.cognome)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                              {attivista.nome} {attivista.cognome}
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={`text-xs ${getStatusColor(attivista.status)}`}>
                                {translateStatus(attivista.status)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {attivista.ruolo}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {/* Email */}
                          <div>
                            <span className="text-sm font-medium text-gray-500">Email:</span>
                            <p className="text-sm text-gray-900 truncate">{attivista.email}</p>
                          </div>

                          {/* Residenza */}
                          {attivista.comune_residenza && (
                            <div>
                              <span className="text-sm font-medium text-gray-500">Residenza:</span>
                              <p className="text-sm text-gray-900">
                                {attivista.comune_residenza}
                                {attivista.provincia_residenza && `, ${attivista.provincia_residenza}`}
                                {attivista.regione_residenza && `, ${attivista.regione_residenza}`}
                              </p>
                            </div>
                          )}

                          {/* Data di nascita */}
                          {attivista.data_nascita && (
                            <div>
                              <span className="text-sm font-medium text-gray-500">Data di nascita:</span>
                              <p className="text-sm text-gray-900">
                                {formatDate(attivista.data_nascita)}
                              </p>
                            </div>
                          )}

                          {/* Cittadinanza */}
                          {attivista.cittadinanza && (
                            <div>
                              <span className="text-sm font-medium text-gray-500">Cittadinanza:</span>
                              <p className="text-sm text-gray-900">{attivista.cittadinanza}</p>
                            </div>
                          )}

                          {/* Data registrazione */}
                          <div>
                            <span className="text-sm font-medium text-gray-500">Registrato il:</span>
                            <p className="text-sm text-gray-900">
                              {formatDate(attivista.created_at)}
                            </p>
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
      </PageContainer>
    </PageTransition>
  );
}