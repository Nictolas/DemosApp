import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Database, Pause, RefreshCw, Shield } from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface JobStatus {
  isRunning: boolean;
  hasCleanupInterval: boolean;
  hasNotificationInterval: boolean;
}

// RP-10: la retention legacy non è approvata.
// Questa schermata permette soltanto di consultare lo stato e fermare un job già attivo.
// L'assenza dei pulsanti è solo una protezione UX: il backend deve rifiutare
// autonomamente gli endpoint distruttivi con RETENTION_POLICY_NOT_APPROVED.
const DataRetention: React.FC = () => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/admin/data-retention/job/status');
      const payload = await response.json();
      if (!payload.success || !payload.data?.status) {
        throw new Error('Stato del job non disponibile');
      }
      setJobStatus(payload.data.status);
    } catch {
      setJobStatus(null);
      setError('Impossibile recuperare lo stato della retention.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleStopJob = async () => {
    try {
      setStopping(true);
      setError(null);
      setSuccess(null);
      const response = await apiRequest('POST', '/admin/data-retention/job/stop');
      const payload = await response.json();
      if (!payload.success) {
        throw new Error('Arresto non confermato');
      }
      setSuccess('Richiesta di arresto del job completata.');
      await loadStatus();
    } catch {
      setError('Impossibile arrestare il job di retention.');
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-20 bg-white min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Retention</h1>
        <p className="text-gray-600">Monitoraggio dello stato del servizio di conservazione dei dati.</p>
      </div>

      <Alert className="mb-6 bg-white" role="status">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Politica di retention non approvata.</strong> L'avvio automatico e le
          operazioni manuali di cancellazione non sono disponibili da questa pagina.
          I periodi storici e i conteggi di dati scaduti non sono mostrati perché
          non costituiscono ancora una politica verificata.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert className="mb-6 bg-white" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-6 bg-white" role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Stato del job
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Caricamento dello stato...
            </div>
          ) : jobStatus ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={jobStatus.isRunning ? 'default' : 'secondary'}>
                {jobStatus.isRunning ? 'In esecuzione' : 'Non in esecuzione'}
              </Badge>
              <span className="text-sm text-gray-600">
                Pulizia programmata: {jobStatus.hasCleanupInterval ? 'Sì' : 'No'}
              </span>
              <span className="text-sm text-gray-600">
                Notifiche programmate: {jobStatus.hasNotificationInterval ? 'Sì' : 'No'}
              </span>
              {jobStatus.isRunning && (
                <Button onClick={handleStopJob} variant="outline" size="sm" disabled={stopping}>
                  <Pause className="h-4 w-4 mr-2" />
                  {stopping ? 'Arresto in corso...' : 'Ferma job'}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Stato non disponibile.</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Conservazione dei dati
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Le finalità, le durate e le procedure di cancellazione sono in revisione.
          Questa pagina non autorizza cancellazioni né certifica la retention
          dei fornitori esterni. L'eventuale riattivazione richiederà controlli
          e approvazioni specifiche.
        </CardContent>
      </Card>
    </div>
  );
};

export default DataRetention;
