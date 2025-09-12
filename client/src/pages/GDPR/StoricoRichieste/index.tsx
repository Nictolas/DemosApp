import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, FileText, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import apiRequest from "@/lib/api-request";

interface GDPRRequest {
  id: string;
  tipo: string;
  stato: 'pending' | 'completed' | 'rejected';
  data_richiesta: string;
  data_completamento?: string;
  dettagli?: string;
  risposta?: string;
}

export default function StoricoRichieste() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('/user/gdpr-requests', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.success) {
        setRequests(response.data || []);
      } else {
        setError(response.error || 'Errore nel caricamento delle richieste');
      }
    } catch (err) {
      console.error('Errore nel caricamento richieste:', err);
      setError('Errore di connessione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (stato: string) => {
    switch (stato) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (stato: string) => {
    switch (stato) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completata</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rifiutata</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Elaborazione</Badge>;
      default:
        return <Badge variant="outline">Sconosciuto</Badge>;
    }
  };

  const getRequestTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'access':
        return 'Diritto di Accesso (Art. 15)';
      case 'deletion':
        return 'Diritto di Cancellazione (Art. 17)';
      case 'restriction':
        return 'Limitazione Trattamento (Art. 18)';
      case 'objection':
        return 'Opposizione Trattamento (Art. 21)';
      case 'portability':
        return 'Portabilità Dati (Art. 20)';
      case 'rectification':
        return 'Rettifica Dati (Art. 16)';
      default:
        return tipo;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per visualizzare lo storico richieste.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/auth')}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/gdpr')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna a GDPR
          </Button>
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Storico Richieste GDPR
              </CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Visualizza tutte le tue richieste relative ai diritti GDPR
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Informazioni */}
        <Alert className="mb-6">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>Storico Richieste:</strong> Qui puoi visualizzare tutte le richieste che hai 
            inviato per esercitare i tuoi diritti GDPR, il loro stato di elaborazione e le eventuali risposte.
          </AlertDescription>
        </Alert>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Caricamento richieste...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Requests List */}
        {!loading && !error && (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    Nessuna richiesta presente
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Non hai ancora inviato richieste per esercitare i tuoi diritti GDPR.
                  </p>
                  <Button 
                    onClick={() => setLocation('/gdpr')}
                    variant="outline"
                  >
                    Esplora i Diritti GDPR
                  </Button>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.stato)}
                        <div>
                          <CardTitle className="text-lg">
                            {getRequestTypeLabel(request.tipo)}
                          </CardTitle>
                          <CardDescription>
                            Richiesta del {formatDate(request.data_richiesta)}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(request.stato)}
                    </div>
                  </CardHeader>
                  
                  {request.dettagli && (
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-sm text-gray-700 mb-1">Dettagli Richiesta:</h4>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {request.dettagli}
                          </p>
                        </div>
                        
                        {request.risposta && (
                          <div>
                            <h4 className="font-medium text-sm text-gray-700 mb-1">Risposta:</h4>
                            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                              {request.risposta}
                            </p>
                          </div>
                        )}
                        
                        {request.data_completamento && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Completata il {formatDate(request.data_completamento)}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* Refresh Button */}
        {!loading && (
          <div className="mt-8 text-center">
            <Button 
              onClick={loadRequests}
              variant="outline"
              className="mr-2"
            >
              <Clock className="h-4 w-4 mr-2" />
              Aggiorna Lista
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
