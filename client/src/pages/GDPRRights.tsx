import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  Trash2, 
  Shield, 
  Ban, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-neon';
import apiRequest from '../lib/api-request';

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

  // Stati per i form
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [limitCategories, setLimitCategories] = useState<string[]>([]);
  const [objectionReason, setObjectionReason] = useState('');
  const [objectionCategories, setObjectionCategories] = useState<string[]>([]);

  const availableCategories = [
    { id: 'personal_data', label: 'Dati Personali' },
    { id: 'political_opinions', label: 'Opinioni Politiche' },
    { id: 'voting_data', label: 'Dati di Voto' },
    { id: 'communication_data', label: 'Dati di Comunicazione' },
    { id: 'technical_data', label: 'Dati Tecnici' },
    { id: 'marketing_data', label: 'Dati di Marketing' }
  ];

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

  const handleDataExport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', '/api/user/data-export');
      if (response.ok) {
        const data = await response.json();
        
        // Crea e scarica il file JSON
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { 
          type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `demos-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setSuccess('Esportazione dati completata con successo!');
        loadRightsRequests();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Errore durante l\'esportazione');
      }
    } catch (error) {
      setError('Errore di connessione durante l\'esportazione');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deletionConfirmation !== 'CONFERMO_CANCELLAZIONE_ACCOUNT') {
      setError('Devi digitare esattamente: CONFERMO_CANCELLAZIONE_ACCOUNT');
      return;
    }

    if (!confirm('Sei sicuro di voler cancellare definitivamente il tuo account? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('DELETE', '/api/user/account', {
        confirmation: deletionConfirmation
      });
      
      if (response.ok) {
        setSuccess('Account cancellato con successo. Verrai reindirizzato alla homepage.');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Errore durante la cancellazione');
      }
    } catch (error) {
      setError('Errore di connessione durante la cancellazione');
    } finally {
      setLoading(false);
    }
  };

  const handleLimitProcessing = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('PUT', '/api/user/limit-processing', {
        limited: true,
        categories: limitCategories,
        reason: 'Richiesta limitazione trattamento dati'
      });
      
      if (response.ok) {
        setSuccess('Limitazioni di trattamento applicate con successo!');
        setLimitCategories([]);
        loadRightsRequests();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Errore durante l\'applicazione delle limitazioni');
      }
    } catch (error) {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const handleObjectProcessing = async () => {
    if (!objectionReason.trim()) {
      setError('Devi fornire un motivo per l\'opposizione');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('POST', '/api/user/object', {
        reason: objectionReason,
        categories: objectionCategories
      });
      
      if (response.ok) {
        setSuccess('Opposizione al trattamento registrata. Verrà esaminata entro 30 giorni.');
        setObjectionReason('');
        setObjectionCategories([]);
        loadRightsRequests();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Errore durante la registrazione dell\'opposizione');
      }
    } catch (error) {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string, categories: string[], setCategories: (cats: string[]) => void) => {
    if (categories.includes(categoryId)) {
      setCategories(categories.filter(cat => cat !== categoryId));
    } else {
      setCategories([...categories, categoryId]);
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Gestione Diritti GDPR</h1>
        <p className="text-gray-600">
          Gestisci i tuoi diritti sulla protezione dei dati personali secondo il GDPR.
        </p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Diritto di Accesso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="w-5 h-5 mr-2" />
              Diritto di Accesso (Art. 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Scarica una copia completa di tutti i tuoi dati personali in formato JSON.
            </p>
            <Button 
              onClick={handleDataExport} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Esportando...' : 'Scarica i Miei Dati'}
            </Button>
          </CardContent>
        </Card>

        {/* Diritto di Cancellazione */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trash2 className="w-5 h-5 mr-2" />
              Diritto di Cancellazione (Art. 17)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Cancella definitivamente il tuo account e tutti i dati associati.
            </p>
            <div className="space-y-3">
              <Input
                placeholder="Digita: CONFERMO_CANCELLAZIONE_ACCOUNT"
                value={deletionConfirmation}
                onChange={(e) => setDeletionConfirmation(e.target.value)}
              />
              <Button 
                onClick={handleAccountDeletion} 
                disabled={loading || deletionConfirmation !== 'CONFERMO_CANCELLAZIONE_ACCOUNT'}
                variant="destructive"
                className="w-full"
              >
                {loading ? 'Cancellando...' : 'Cancella Account'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Diritto di Limitazione */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Limitazione Trattamento (Art. 18)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Limita il trattamento di specifiche categorie di dati.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {availableCategories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={limitCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id, limitCategories, setLimitCategories)}
                      className="rounded"
                    />
                    <span>{category.label}</span>
                  </label>
                ))}
              </div>
              <Button 
                onClick={handleLimitProcessing} 
                disabled={loading || limitCategories.length === 0}
                className="w-full"
              >
                {loading ? 'Applicando...' : 'Applica Limitazioni'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Diritto di Opposizione */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Ban className="w-5 h-5 mr-2" />
              Opposizione Trattamento (Art. 21)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Opponi al trattamento per motivi legittimi.
            </p>
            <div className="space-y-3">
              <Textarea
                placeholder="Motivo dell'opposizione..."
                value={objectionReason}
                onChange={(e) => setObjectionReason(e.target.value)}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-2">
                {availableCategories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={objectionCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id, objectionCategories, setObjectionCategories)}
                      className="rounded"
                    />
                    <span>{category.label}</span>
                  </label>
                ))}
              </div>
              <Button 
                onClick={handleObjectProcessing} 
                disabled={loading || !objectionReason.trim()}
                className="w-full"
              >
                {loading ? 'Registrando...' : 'Registra Opposizione'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storico Richieste */}
      <Card className="mt-8">
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
                <div key={request.id} className="border rounded-lg p-4">
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

      {/* Informazioni Legali */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="w-5 h-5 mr-2" />
            Informazioni Legali
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>Diritto di Accesso (Art. 15 GDPR):</strong> Hai il diritto di ottenere una copia dei tuoi dati personali.
            </p>
            <p>
              <strong>Diritto di Cancellazione (Art. 17 GDPR):</strong> Hai il diritto di richiedere la cancellazione dei tuoi dati.
            </p>
            <p>
              <strong>Diritto di Limitazione (Art. 18 GDPR):</strong> Hai il diritto di limitare il trattamento dei tuoi dati.
            </p>
            <p>
              <strong>Diritto di Opposizione (Art. 21 GDPR):</strong> Hai il diritto di opporti al trattamento per motivi legittimi.
            </p>
            <p className="mt-4 text-xs">
              Per ulteriori informazioni, consulta la nostra{' '}
              <a href="/privacy-policy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
