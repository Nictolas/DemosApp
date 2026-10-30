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
  created_at: string;
  processed_at?: string;
}

// Key the entire history view by the authenticated subject. Changing
// accounts unmounts the previous state (including pending pagination), so a
// late response from user A cannot render under user B's session.
export default function GDPRRights() {
  const { user, isLoading } = useAuth();
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl bg-white min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Storico Richieste GDPR</h1>
        <div role="status">
          {isLoading ? 'Verifica della sessione...' : 'Accedi per consultare le tue richieste.'}
        </div>
      </div>
    );
  }
  return <AuthenticatedRightsHistory key={user.id} />;
}

function AuthenticatedRightsHistory() {
  const [requests, setRequests] = useState<RightsRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  useEffect(() => {
    loadRightsRequests();
  }, []);

  const loadRightsRequests = async (offset: number = 0) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const response = await apiRequest('GET',
        '/api/user/rights-requests?limit=50&offset=' + offset);
      if (!response.ok) throw new Error('GDPR_HISTORY_HTTP_ERROR');
      const payload = await response.json();
      const pagination = payload?.pagination;
      if (payload?.success !== true || !Array.isArray(payload.data) ||
          typeof pagination?.has_more !== 'boolean' ||
          pagination.offset !== offset ||
          (pagination.has_more &&
            (!Number.isSafeInteger(pagination.next_offset) ||
             pagination.next_offset <= offset)) ||
          (!pagination.has_more && pagination.next_offset !== null)) {
        throw new Error('GDPR_HISTORY_INVALID_RESPONSE');
      }
      const page = payload.data as RightsRequest[];
      setRequests(previous => {
        if (offset === 0) return page;
        const existing = new Set(previous.map(request => request.id));
        return [...previous, ...page.filter(request => !existing.has(request.id))];
      });
      setHasMore(pagination.has_more);
      setNextOffset(pagination.next_offset);
    } catch {
      // Never transform an unverified or RLS-filtered response into an
      // apparently genuine empty history. Preserve earlier verified pages
      // on a later pagination failure and permit a retry.
      if (offset === 0) {
        setRequests([]);
        setHasMore(false);
        setNextOffset(null);
      }
      setError('Non è stato possibile verificare lo storico delle richieste. Riprova più tardi o contatta il DPO.');
    } finally {
      if (offset === 0) setLoading(false);
      else setLoadingMore(false);
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
            error ? (
              <div className="text-center py-4 text-gray-500" role="status">
                Storico non disponibile: impossibile verificare le richieste.
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Nessuna richiesta presente
              </div>
            )
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
                  </div>
                </div>
              ))}
              {hasMore && nextOffset !== null && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => loadRightsRequests(nextOffset)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium disabled:opacity-50"
                >
                  {loadingMore ? 'Caricamento altre richieste...' : 'Carica altre richieste'}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
