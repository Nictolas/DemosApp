import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '../lib/queryClient';

interface RightsRequest {
  id: string;
  request_type: string;
  status: string;
  request_data: any;
  response_data: any;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
}

export default function GDPRRights() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RightsRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  useEffect(() => {
    loadRightsRequests();
  }, []);

  const loadRightsRequests = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/api/user/rights-requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error('Errore nel caricamento richieste:', error);
    } finally {
      setLoading(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completata</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />In Elaborazione</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />In Attesa</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rifiutata</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'data_export':
        return 'Esportazione Dati';
      case 'data_erasure':
        return 'Cancellazione Account';
      case 'limit_processing':
        return 'Limitazione Trattamento';
      case 'object_processing':
        return 'Opposizione Trattamento';
      case 'data_rectification':
        return 'Rettifica Dati';
      case 'data_portability':
        return 'Portabilità Dati';
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Storico Richieste GDPR</h1>
        <p className="text-gray-600">
          Visualizza tutte le tue richieste relative ai diritti GDPR.
        </p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-white">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-white">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}


      {/* Storico Richieste */}
      <Card className="mt-8 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Storico Richieste
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Caricamento...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Nessuna richiesta presente
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{getRequestTypeLabel(request.request_type)}</h3>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Data richiesta: {new Date(request.created_at).toLocaleString('it-IT')}</p>
                    {request.processed_at && (
                      <p>Data elaborazione: {new Date(request.processed_at).toLocaleString('it-IT')}</p>
                    )}
                    {request.processed_by && (
                      <p>Elaborato da: {request.processed_by}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
