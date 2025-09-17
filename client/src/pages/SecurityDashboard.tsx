import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Database, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  Users,
  FileText,
  Bell,
  Activity,
  Lock,
  Eye,
  Trash2,
  Download,
  RefreshCw,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface SystemStatus {
  audit: {
    enabled: boolean;
    total_actions: number;
    successful_actions: number;
    failed_actions: number;
  };
  dataRetention: {
    enabled: boolean;
    total_records: number;
    expired_records: number;
    active_records: number;
  };
  violations: {
    enabled: boolean;
    total_violations: number;
    critical_violations: number;
    high_violations: number;
    medium_violations: number;
  };
}

const SecurityDashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carica statistiche da tutti i sistemi
      const [auditStats, retentionStats, violationStats] = await Promise.all([
        apiRequest.get('/admin/audit-dashboard/stats').catch(() => ({ success: false })),
        apiRequest.get('/admin/data-retention/stats').catch(() => ({ success: false })),
        apiRequest.get('/admin/violations/monitoring/status').catch(() => ({ success: false }))
      ]);

      setSystemStatus({
        audit: {
          enabled: auditStats.success,
          total_actions: auditStats.data?.general_stats?.total_actions || 0,
          successful_actions: auditStats.data?.general_stats?.successful_actions || 0,
          failed_actions: auditStats.data?.general_stats?.failed_actions || 0
        },
        dataRetention: {
          enabled: retentionStats.success,
          total_records: Object.values(retentionStats.data?.stats || {}).reduce((sum: number, stat: any) => sum + (stat.total_records || 0), 0),
          expired_records: Object.values(retentionStats.data?.stats || {}).reduce((sum: number, stat: any) => sum + (stat.expired_records || 0), 0),
          active_records: Object.values(retentionStats.data?.stats || {}).reduce((sum: number, stat: any) => sum + (stat.active_records || 0), 0)
        },
        violations: {
          enabled: violationStats.success,
          total_violations: violationStats.data?.status?.violationCounts ? 
            Object.values(violationStats.data.status.violationCounts).reduce((sum: number, count: number) => sum + count, 0) : 0,
          critical_violations: violationStats.data?.status?.violationCounts?.CRITICAL || 0,
          high_violations: violationStats.data?.status?.violationCounts?.HIGH || 0,
          medium_violations: violationStats.data?.status?.violationCounts?.MEDIUM || 0
        }
      });

    } catch (err) {
      setError('Errore nel caricamento dello stato del sistema');
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
        loadSystemStatus();
      } else {
        setError(response.error || 'Errore nell\'operazione');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore:', err);
    }
  };

  const getSystemHealth = () => {
    if (!systemStatus) return 'UNKNOWN';
    
    if (systemStatus.violations.critical_violations > 0) return 'CRITICAL';
    if (systemStatus.violations.high_violations > 5) return 'WARNING';
    if (systemStatus.audit.failed_actions > systemStatus.audit.successful_actions) return 'WARNING';
    if (!systemStatus.audit.enabled || !systemStatus.dataRetention.enabled) return 'WARNING';
    
    return 'HEALTHY';
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return 'text-green-600 bg-green-100';
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-100';
      case 'CRITICAL':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl pt-20">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Caricamento stato sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard Sicurezza
        </h1>
        <p className="text-gray-600">
          Panoramica completa dello stato di sicurezza e conformità GDPR
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

      {/* System Health Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Stato Generale Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge className={getHealthColor(getSystemHealth())}>
                {getSystemHealth()}
              </Badge>
              <span className="text-sm text-gray-600">
                Salute del sistema: {getSystemHealth()}
              </span>
            </div>
            <Button onClick={loadSystemStatus} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Logging</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.audit.total_actions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Azioni tracciate
            </p>
            <Badge variant={systemStatus?.audit.enabled ? "default" : "secondary"} className="mt-2">
              {systemStatus?.audit.enabled ? "Attivo" : "Disattivo"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Retention</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.dataRetention.expired_records || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Record scaduti
            </p>
            <Badge variant={systemStatus?.dataRetention.enabled ? "default" : "secondary"} className="mt-2">
              {systemStatus?.dataRetention.enabled ? "Attivo" : "Disattivo"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violazioni</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {systemStatus?.violations.critical_violations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Violazioni critiche
            </p>
            <Badge variant={systemStatus?.violations.enabled ? "default" : "secondary"} className="mt-2">
              {systemStatus?.violations.enabled ? "Monitoraggio Attivo" : "Disattivo"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Azioni Rapide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => handleAction('Rilevamento Violazioni', '/admin/violations/detect')}
              className="w-full justify-start"
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              Rileva Violazioni
            </Button>
            <Button 
              onClick={() => handleAction('Pulizia Dati', '/admin/data-retention/cleanup/immediate')}
              className="w-full justify-start"
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Pulizia Immediata
            </Button>
            <Button 
              onClick={() => window.open('/audit-dashboard', '_blank')}
              className="w-full justify-start"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Visualizza Audit Logs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Statistiche Dettagliate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Azioni Riuscite</span>
                <span className="font-semibold text-green-600">
                  {systemStatus?.audit.successful_actions || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Azioni Fallite</span>
                <span className="font-semibold text-red-600">
                  {systemStatus?.audit.failed_actions || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Record Attivi</span>
                <span className="font-semibold text-blue-600">
                  {systemStatus?.dataRetention.active_records || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Violazioni Totali</span>
                <span className="font-semibold text-orange-600">
                  {systemStatus?.violations.total_violations || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Components Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Stato Componenti Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Audit Logging</span>
              </div>
              <Badge variant={systemStatus?.audit.enabled ? "default" : "destructive"}>
                {systemStatus?.audit.enabled ? "OK" : "ERRORE"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Database className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Data Retention</span>
              </div>
              <Badge variant={systemStatus?.dataRetention.enabled ? "default" : "destructive"}>
                {systemStatus?.dataRetention.enabled ? "OK" : "ERRORE"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium">Monitoraggio Violazioni</span>
              </div>
              <Badge variant={systemStatus?.violations.enabled ? "default" : "destructive"}>
                {systemStatus?.violations.enabled ? "OK" : "ERRORE"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Management Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dashboard Sicurezza e Monitoraggio */}
        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-blue-600" />
              Dashboard Sicurezza e Monitoraggio
            </CardTitle>
            <p className="text-sm text-gray-600">
              Panoramica completa di sicurezza, audit logs, violazioni, rate limiting, validazione e performance
            </p>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.open('/admin/security-dashboard', '_blank')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Activity className="h-4 w-4 mr-2" />
              Apri Dashboard Sicurezza
            </Button>
          </CardContent>
        </Card>

        {/* Gestione GDPR e Legale */}
        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-green-600" />
              Gestione GDPR e Legale
            </CardTitle>
            <p className="text-sm text-gray-600">
              Gestisci diritti GDPR, data retention e documenti legali in un'unica interfaccia
            </p>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.open('/admin/gdpr-legal', '_blank')}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Apri Gestione GDPR
            </Button>
          </CardContent>
        </Card>

        {/* Backup e Recovery */}
        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2 text-indigo-600" />
              Backup e Recovery
            </CardTitle>
            <p className="text-sm text-gray-600">
              Gestisci backup automatici e manuali del database per continuità operativa
            </p>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.open('/admin/backup', '_blank')}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            >
              <Database className="h-4 w-4 mr-2" />
              Gestisci Backup
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Informazioni Dashboard Sicurezza
              </h3>
              <p className="text-sm text-blue-800">
                Questa dashboard fornisce una panoramica completa dello stato di sicurezza e conformità GDPR dell'applicazione.
                Monitora tutti i componenti critici e accedi rapidamente agli strumenti di gestione.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityDashboard;
