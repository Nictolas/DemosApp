import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Shield, 
  Lock, 
  Eye, 
  RefreshCw, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle,
  Info,
  Bell,
  Activity
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface Violation {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  details: any;
  timestamp: string;
}

interface ViolationStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  violations: Violation[];
}

const ViolationsDashboard: React.FC = () => {
  const [stats, setStats] = useState<ViolationStats | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [detectionResult, statusResult] = await Promise.all([
        apiRequest.get('/admin/violations/detect'),
        apiRequest.get('/admin/violations/monitoring/status')
      ]);

      if (detectionResult.success) {
        setStats(detectionResult.data.detection_result);
      }

      if (statusResult.success) {
        setMonitoringStatus(statusResult.data.status);
      }

    } catch (err) {
      setError('Errore nel caricamento dei dati');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, endpoint: string, data: any = {}) => {
    try {
      setError(null);
      setSuccess(null);

      const response = await apiRequest.post(endpoint, data);
      
      if (response.success) {
        setSuccess(response.message || 'Operazione completata con successo');
        loadData();
      } else {
        setError(response.error || 'Errore nell\'operazione');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl pt-20">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Caricamento violazioni...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard Violazioni
        </h1>
        <p className="text-gray-600">
          Monitora e gestisci le violazioni di sicurezza e conformità GDPR
        </p>
      </div>

      {error && (
        <Alert className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Violazioni</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Violazioni rilevate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critiche</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.critical || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Richiedono attenzione immediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alte</CardTitle>
            <Lock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.high || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Priorità elevata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medie</CardTitle>
            <Eye className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.medium || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Monitoraggio continuo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Controllo Monitoraggio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant={monitoringStatus?.isRunning ? "default" : "secondary"}>
                {monitoringStatus?.isRunning ? "Attivo" : "Fermato"}
              </Badge>
              <span className="text-sm text-gray-600">
                Monitoraggio: {monitoringStatus?.isRunning ? "Attivo" : "Disattivo"}
              </span>
            </div>
            <div className="flex space-x-2">
              {monitoringStatus?.isRunning ? (
                <Button 
                  onClick={() => handleAction('Ferma Monitoraggio', '/admin/violations/monitoring/stop')}
                  variant="outline"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Ferma
                </Button>
              ) : (
                <Button 
                  onClick={() => handleAction('Avvia Monitoraggio', '/admin/violations/monitoring/start')}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Avvia
                </Button>
              )}
              <Button 
                onClick={() => handleAction('Rilevamento Immediato', '/admin/violations/monitoring/immediate')}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Rileva Ora
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Violations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Violazioni Rilevate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.violations && stats.violations.length > 0 ? (
            <div className="space-y-4">
              {stats.violations.map((violation, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{violation.type}</h3>
                    <Badge className={getSeverityColor(violation.severity)}>
                      {violation.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{violation.description}</p>
                  <div className="text-xs text-gray-500">
                    <strong>Timestamp:</strong> {new Date(violation.timestamp).toLocaleString()}
                  </div>
                  {violation.details && (
                    <div className="mt-2 text-xs text-gray-500">
                      <strong>Dettagli:</strong> {JSON.stringify(violation.details, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">Nessuna violazione rilevata</p>
              <p className="text-sm text-gray-500">Il sistema è sicuro e conforme</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Informazioni Monitoraggio Violazioni
              </h3>
              <p className="text-sm text-blue-800">
                Il sistema monitora automaticamente le violazioni di sicurezza e conformità GDPR.
                Le violazioni critiche richiedono attenzione immediata, mentre quelle ad alta e media priorità
                vengono gestite secondo le soglie configurate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ViolationsDashboard;
