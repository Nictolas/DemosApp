import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Download, 
  Upload, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  AlertTriangle,
  Info,
  HardDrive,
  FileText,
  Settings
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface Backup {
  fileName: string;
  type: 'full' | 'incremental';
  timestamp: string;
  size: number;
  recordCounts: Record<string, number>;
  checksum: string;
}

interface BackupStats {
  totalBackups: number;
  fullBackups: number;
  incrementalBackups: number;
  totalSize: number;
  lastBackup: string | null;
  oldestBackup: string | null;
  config: {
    retentionDays: number;
    maxBackups: number;
    encryptionEnabled: boolean;
    compressionEnabled: boolean;
  };
}

const BackupDashboard: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
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

      const [backupsResult, statsResult, statusResult] = await Promise.all([
        apiRequest.get('/admin/backup/list'),
        apiRequest.get('/admin/backup/stats'),
        apiRequest.get('/admin/backup/job/status')
      ]);

      if (backupsResult.success) {
        setBackups(backupsResult.data.backups);
      }

      if (statsResult.success) {
        setStats(statsResult.data.stats);
      }

      if (statusResult.success) {
        setJobStatus(statusResult.data.status);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'full':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'incremental':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl pt-20">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Caricamento backup...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard Backup e Recovery
        </h1>
        <p className="text-gray-600">
          Gestisci i backup automatici e manuali del database per garantire la continuità operativa
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
            <CardTitle className="text-sm font-medium">Totale Backup</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalBackups || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Backup disponibili
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backup Completi</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.fullBackups || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Backup completi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backup Incrementali</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.incrementalBackups || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Backup incrementali
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spazio Totale</CardTitle>
            <HardDrive className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats ? formatFileSize(stats.totalSize) : '0 Bytes'}
            </div>
            <p className="text-xs text-muted-foreground">
              Spazio utilizzato
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Controllo Job di Backup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant={jobStatus?.isRunning ? "default" : "secondary"}>
                {jobStatus?.isRunning ? "Attivo" : "Fermato"}
              </Badge>
              <span className="text-sm text-gray-600">
                Job automatico: {jobStatus?.isRunning ? "Attivo" : "Disattivo"}
              </span>
              {jobStatus?.lastFullBackup && (
                <span className="text-xs text-gray-500">
                  Ultimo completo: {formatDate(jobStatus.lastFullBackup)}
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              {jobStatus?.isRunning ? (
                <Button 
                  onClick={() => handleAction('Ferma Job', '/admin/backup/job/stop')}
                  variant="outline"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Ferma
                </Button>
              ) : (
                <Button 
                  onClick={() => handleAction('Avvia Job', '/admin/backup/job/start')}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Avvia
                </Button>
              )}
              <Button 
                onClick={() => handleAction('Backup Immediato', '/admin/backup/job/immediate', { type: 'full' })}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Backup Ora
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Azioni Rapide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => handleAction('Backup Completo', '/admin/backup/create/full')}
              className="w-full justify-start"
              variant="outline"
            >
              <Shield className="h-4 w-4 mr-2" />
              Crea Backup Completo
            </Button>
            <Button 
              onClick={() => handleAction('Backup Incrementale', '/admin/backup/create/incremental')}
              className="w-full justify-start"
              variant="outline"
            >
              <Clock className="h-4 w-4 mr-2" />
              Crea Backup Incrementale
            </Button>
            <Button 
              onClick={() => handleAction('Test Integrità', '/admin/backup/test/integrity')}
              className="w-full justify-start"
              variant="outline"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Test Integrità
            </Button>
            <Button 
              onClick={() => handleAction('Pulizia Backup', '/admin/backup/cleanup')}
              className="w-full justify-start"
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Pulisci Backup Vecchi
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Configurazione
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Retention Policy</span>
                <span className="font-semibold text-blue-600">
                  {stats?.config.retentionDays || 0} giorni
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Max Backup</span>
                <span className="font-semibold text-green-600">
                  {stats?.config.maxBackups || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Crittografia</span>
                <Badge variant={stats?.config.encryptionEnabled ? "default" : "secondary"}>
                  {stats?.config.encryptionEnabled ? "Attiva" : "Disattiva"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Compressione</span>
                <Badge variant={stats?.config.compressionEnabled ? "default" : "secondary"}>
                  {stats?.config.compressionEnabled ? "Attiva" : "Disattiva"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Lista Backup Disponibili
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length > 0 ? (
            <div className="space-y-4">
              {backups.map((backup, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold">{backup.fileName}</h3>
                      <Badge className={getTypeColor(backup.type)}>
                        {backup.type}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {formatFileSize(backup.size)}
                      </span>
                      <Button 
                        onClick={() => handleAction('Ripristina', `/admin/backup/restore/${backup.fileName}`)}
                        variant="outline"
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Ripristina
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Creato:</strong> {formatDate(backup.timestamp)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Record:</strong> {Object.entries(backup.recordCounts).map(([table, count]) => `${table}: ${count}`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nessun backup disponibile</p>
              <p className="text-sm text-gray-500">Crea il tuo primo backup per iniziare</p>
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
                Informazioni Sistema Backup
              </h3>
              <p className="text-sm text-blue-800">
                Il sistema di backup garantisce la continuità operativa attraverso backup automatici completi e incrementali.
                I backup sono crittografati e verificati per garantire l'integrità dei dati.
                La retention policy cancella automaticamente i backup più vecchi per ottimizzare lo spazio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupDashboard;
