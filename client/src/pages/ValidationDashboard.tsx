// File: client/src/pages/ValidationDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Clock, 
  Trash2, 
  RefreshCw,
  Eye,
  BarChart3,
  Globe,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface ValidationFailure {
  id: string;
  ip_address: string;
  user_agent: string;
  endpoint: string;
  errors: string[];
  input_data: any;
  timestamp: string;
}

interface ValidationStats {
  total_failures: number;
  unique_ips: number;
  unique_endpoints: number;
  failures_by_type: { [key: string]: number };
  failures_by_endpoint: { [key: string]: number };
  recent_failures: ValidationFailure[];
}

const ValidationDashboard: React.FC = () => {
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFailure, setSelectedFailure] = useState<ValidationFailure | null>(null);

  // Carica statistiche validazione
  const loadValidationStats = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/admin/validation/stats', 'GET');
      
      if (response.success) {
        setStats(response.data);
        setError(null);
      } else {
        setError('Errore nel caricamento delle statistiche');
      }
    } catch (err) {
      console.error('Errore nel caricamento statistiche validazione:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Carica dettagli fallimento
  const loadFailureDetails = async (failureId: string) => {
    try {
      const response = await apiRequest(`/admin/validation/failure/${failureId}`, 'GET');
      
      if (response.success) {
        setSelectedFailure(response.data);
      } else {
        alert('Errore nel caricamento dei dettagli');
      }
    } catch (err) {
      console.error('Errore nel caricamento dettagli:', err);
      alert('Errore di connessione');
    }
  };

  // Pulisci fallimenti vecchi
  const handleCleanup = async () => {
    try {
      const response = await apiRequest('/admin/validation/cleanup', 'POST', {
        retentionDays: 30
      });
      
      if (response.success) {
        alert(`Pulizia completata: rimossi ${response.data.deletedCount} fallimenti`);
        loadValidationStats(); // Ricarica i dati
      } else {
        alert('Errore nella pulizia');
      }
    } catch (err) {
      console.error('Errore nella pulizia:', err);
      alert('Errore di connessione');
    }
  };

  useEffect(() => {
    loadValidationStats();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Caricamento dashboard validazione...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Dashboard Validazione Input
        </h1>
        <p className="text-gray-600">
          Monitora e gestisci i fallimenti di validazione per la sicurezza dell'applicazione.
        </p>
      </div>

      {/* Statistiche Generali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fallimenti Totali</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.total_failures || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Ultimi 7 giorni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IP Unici</CardTitle>
            <Globe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.unique_ips || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Con fallimenti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Endpoint</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.unique_endpoints || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Con fallimenti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipo Più Comune</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.failures_by_type ? Object.keys(stats.failures_by_type)[0] || 'N/A' : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Errore più frequente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Azioni di Gestione */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Gestione Dati
          </CardTitle>
          <CardDescription>
            Pulisci i fallimenti di validazione vecchi per mantenere le performance del database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleCleanup} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Pulisci Fallimenti (30 giorni)
            </Button>
            <Button onClick={loadValidationStats} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fallimenti per Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Fallimenti per Tipo
            </CardTitle>
            <CardDescription>
              Distribuzione degli errori di validazione per tipo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.failures_by_type && Object.keys(stats.failures_by_type).length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nessun fallimento registrato</p>
              ) : (
                Object.entries(stats?.failures_by_type || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{type}</div>
                    </div>
                    <Badge variant="destructive">
                      {count}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fallimenti per Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Fallimenti per Endpoint
            </CardTitle>
            <CardDescription>
              Endpoint con più fallimenti di validazione.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.failures_by_endpoint && Object.keys(stats.failures_by_endpoint).length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nessun fallimento registrato</p>
              ) : (
                Object.entries(stats?.failures_by_endpoint || {}).map(([endpoint, count]) => (
                  <div key={endpoint} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-mono text-sm">{endpoint}</div>
                    </div>
                    <Badge variant="destructive">
                      {count}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fallimenti Recenti */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Fallimenti Recenti
          </CardTitle>
          <CardDescription>
            Ultimi fallimenti di validazione registrati.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.recent_failures && stats.recent_failures.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nessun fallimento recente</p>
            ) : (
              stats?.recent_failures.map((failure) => (
                <div key={failure.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-mono text-sm">{failure.endpoint}</div>
                      <div className="text-xs text-gray-500">{failure.ip_address}</div>
                      <div className="text-xs text-gray-500">
                        {failure.errors.length} errori
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {new Date(failure.timestamp).toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadFailureDetails(failure.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Dettagli
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Dettagli Fallimento */}
      {selectedFailure && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Dettagli Fallimento</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFailure(null)}
              >
                Chiudi
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <strong>Endpoint:</strong> {selectedFailure.endpoint}
              </div>
              <div>
                <strong>IP:</strong> {selectedFailure.ip_address}
              </div>
              <div>
                <strong>Timestamp:</strong> {new Date(selectedFailure.timestamp).toLocaleString()}
              </div>
              <div>
                <strong>Errori:</strong>
                <ul className="list-disc list-inside mt-2">
                  {selectedFailure.errors.map((error, index) => (
                    <li key={index} className="text-red-600">{error}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Dati Input:</strong>
                <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-x-auto">
                  {JSON.stringify(selectedFailure.input_data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationDashboard;
