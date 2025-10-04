import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Trash2, 
  Clock, 
  Shield, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Play,
  Pause,
  RefreshCw,
  Info
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface RetentionPolicy {
  retention_days: number;
  fields: string[];
  reason: string;
}

interface RetentionStats {
  total_records: number;
  expired_records: number;
  active_records: number;
  retention_days: number;
  reason: string;
}

interface JobStatus {
  isRunning: boolean;
  hasCleanupInterval: boolean;
  hasNotificationInterval: boolean;
}

const DataRetention: React.FC = () => {
  const [policies, setPolicies] = useState<Record<string, RetentionPolicy>>({});
  const [stats, setStats] = useState<Record<string, RetentionStats>>({});
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
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

      const [policiesRes, statsRes, statusRes] = await Promise.all([
        apiRequest.get('/admin/data-retention/policies'),
        apiRequest.get('/admin/data-retention/stats'),
        apiRequest.get('/admin/data-retention/job/status')
      ]);

      if (policiesRes.success) {
        setPolicies(policiesRes.data.policies);
      }

      if (statsRes.success) {
        setStats(statsRes.data.stats);
      }

      if (statusRes.success) {
        setJobStatus(statusRes.data.status);
      }

    } catch (err) {
      setError('Errore nel caricamento dei dati');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async () => {
    try {
      const response = await apiRequest.post('/admin/data-retention/job/start');
      if (response.success) {
        setSuccess('Job di data retention avviato');
        loadData();
      }
    } catch (err) {
      setError('Errore nell\'avvio del job');
    }
  };

  const handleStopJob = async () => {
    try {
      const response = await apiRequest.post('/admin/data-retention/job/stop');
      if (response.success) {
        setSuccess('Job di data retention fermato');
        loadData();
      }
    } catch (err) {
      setError('Errore nell\'arresto del job');
    }
  };

  const handleImmediateCleanup = async () => {
    try {
      const response = await apiRequest.post('/admin/data-retention/cleanup/immediate');
      if (response.success) {
        setSuccess(`Pulizia completata: ${response.data.total_deleted} record cancellati`);
        loadData();
      }
    } catch (err) {
      setError('Errore nella pulizia immediata');
    }
  };

  const formatDays = (days: number) => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      return remainingDays > 0 ? `${years} anni e ${remainingDays} giorni` : `${years} anni`;
    }
    return `${days} giorni`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl pt-20 bg-white min-h-screen">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Caricamento...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gestione Data Retention
        </h1>
        <p className="text-gray-600">
          Gestisci la cancellazione automatica dei dati scaduti secondo il GDPR
        </p>
      </div>

      {error && (
        <Alert className="mb-6 bg-white">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-white">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Job Status */}
      <Card className="mb-6 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Stato Job di Data Retention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobStatus && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Badge variant={jobStatus.isRunning ? "default" : "secondary"}>
                  {jobStatus.isRunning ? "Attivo" : "Fermato"}
                </Badge>
                <span className="text-sm text-gray-600">
                  Pulizia: {jobStatus.hasCleanupInterval ? "Attiva" : "Disattiva"}
                </span>
                <span className="text-sm text-gray-600">
                  Notifiche: {jobStatus.hasNotificationInterval ? "Attive" : "Disattive"}
                </span>
              </div>
              <div className="flex space-x-2">
                {jobStatus.isRunning ? (
                  <Button onClick={handleStopJob} variant="outline" size="sm">
                    <Pause className="h-4 w-4 mr-2" />
                    Ferma
                  </Button>
                ) : (
                  <Button onClick={handleStartJob} size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Avvia
                  </Button>
                )}
                <Button onClick={handleImmediateCleanup} variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Pulizia Immediata
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policies */}
      <Card className="mb-6 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Policy di Retention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(policies).map(([dataType, policy]) => (
              <div key={dataType} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg capitalize">
                    {dataType.replace('_', ' ')}
                  </h3>
                  <Badge variant="outline">
                    {formatDays(policy.retention_days)}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">{policy.reason}</p>
                <div className="text-xs text-gray-500">
                  <strong>Campi:</strong> {policy.fields.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Statistiche Data Retention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats).map(([dataType, stat]) => (
              <div key={dataType} className="border rounded-lg p-4 bg-white">
                <h3 className="font-semibold mb-2 capitalize">
                  {dataType.replace('_', ' ')}
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Totale:</span>
                    <span className="font-medium">{stat.total_records}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Attivi:</span>
                    <span className="font-medium text-green-600">{stat.active_records}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scaduti:</span>
                    <span className="font-medium text-red-600">{stat.expired_records}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retention:</span>
                    <span className="font-medium">{formatDays(stat.retention_days)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="mt-6 bg-white">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Informazioni Data Retention
              </h3>
              <p className="text-sm text-blue-800">
                Il sistema di data retention cancella automaticamente i dati scaduti secondo le policy configurate.
                I dati vengono cancellati in base alla loro tipologia e al periodo di retention stabilito dal GDPR.
                Le notifiche vengono inviate 30 giorni prima della cancellazione.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataRetention;
