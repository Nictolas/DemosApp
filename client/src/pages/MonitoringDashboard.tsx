// File: client/src/pages/MonitoringDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Play, 
  Square,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Heart,
  Zap
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface HealthCheck {
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
  timestamp: string;
  [key: string]: any;
}

interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CRITICAL';
  timestamp: string;
  checks: Record<string, HealthCheck>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface PerformanceMetrics {
  system: any;
  application: any;
  database: any;
  memory: any;
  network: any;
  errors: any;
}

interface DiskBreakdownEntry {
  path: string;
  name: string;
  sizeBytes: number;
  sizeHuman: string;
  percentOfTarget: number;
}

interface DiskBreakdownData {
  source: string;
  sourceLabel: string;
  root: string;
  target: string;
  totalBytes: number;
  totalHuman: string;
  entries: DiskBreakdownEntry[];
}

interface DatabaseDetails {
  connections?: {
    total_connections?: number;
    active_connections?: number;
    idle_connections?: number;
    idle_in_transaction?: number;
  };
  size?: {
    database_size?: string;
    database_size_bytes?: number;
    users_table_size?: string;
    users_table_size_bytes?: number;
  };
  slowQueries?: Array<{
    query: string;
    mean_exec_time: number;
    calls: number;
    total_exec_time: number;
  }>;
}

const MonitoringDashboard: React.FC = () => {
  const [location] = useLocation();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [diskBreakdown, setDiskBreakdown] = useState<DiskBreakdownData | null>(null);
  const [databaseDetails, setDatabaseDetails] = useState<DatabaseDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Carica stato salute sistema
  const loadSystemHealth = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/admin/monitoring/health');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true) {
        // Validazione minima della shape attesa
        if (serverPayload.data?.checks && serverPayload.data?.summary) {
          setSystemHealth(serverPayload.data);
          return;
        }
        setError('Risposta non valida da /admin/monitoring/health');
        return;
      }
      if (serverPayload?.error) {
        if (String(serverPayload.error).includes('401') || String(serverPayload.error).includes('403') || String(serverPayload.error).toLowerCase().includes('forbidden')) {
          setError('Serve ruolo admin per leggere /admin/monitoring/*');
          return;
        }
        setError(`Impossibile caricare /admin/monitoring/health: ${String(serverPayload.error)}`);
        return;
      }
      // Fallback: in alcuni casi la response può già contenere healthStatus direttamente
      if (serverPayload?.summary && serverPayload?.checks) {
        setSystemHealth(serverPayload);
        return;
      }
      setError('Risposta non valida da /admin/monitoring/health');
    } catch (err) {
      setError('Errore caricamento stato salute');
    } finally {
      setLoading(false);
    }
  };

  // Carica metriche performance
  const loadPerformanceMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/admin/monitoring/performance');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true) {
        const metrics = serverPayload.data?.metrics;
        if (metrics?.application && metrics?.database && metrics?.system && metrics?.memory) {
          setPerformanceMetrics(metrics);
          return;
        }
        setError('Risposta non valida da /admin/monitoring/performance');
        return;
      }
      if (serverPayload?.error) {
        if (String(serverPayload.error).includes('401') || String(serverPayload.error).includes('403') || String(serverPayload.error).toLowerCase().includes('forbidden')) {
          setError('Serve ruolo admin per leggere /admin/monitoring/*');
          return;
        }
        setError(`Impossibile caricare /admin/monitoring/performance: ${String(serverPayload.error)}`);
        return;
      }
      // Fallback: prova a estrarre direttamente
      if (serverPayload?.metrics) {
        setPerformanceMetrics(serverPayload.metrics);
        return;
      }
      setError('Risposta non valida da /admin/monitoring/performance');
    } catch (err) {
      setError('Errore caricamento metriche performance');
    } finally {
      setLoading(false);
    }
  };

  // Carica riepilogo sistema
  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/admin/monitoring/summary');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true) {
        const summaryData = serverPayload.data;
        if (summaryData?.current && summaryData?.last24h && summaryData?.trends) {
          setSummary(summaryData);
          return;
        }
        setError('Risposta non valida da /admin/monitoring/summary');
        return;
      }
      if (serverPayload?.last24h) {
        setSummary(serverPayload);
        return;
      }
      if (serverPayload?.error) {
        if (String(serverPayload.error).includes('401') || String(serverPayload.error).includes('403') || String(serverPayload.error).toLowerCase().includes('forbidden')) {
          setError('Serve ruolo admin per leggere /admin/monitoring/*');
          return;
        }
        setError(`Impossibile caricare /admin/monitoring/summary: ${String(serverPayload.error)}`);
        return;
      }
      setError('Risposta non valida da /admin/monitoring/summary');
    } catch (err) {
      setError('Errore caricamento riepilogo');
    } finally {
      setLoading(false);
    }
  };

  // Carica stato monitoraggio
  const loadMonitoringStatus = async () => {
    try {
      const response = await apiRequest('GET', '/admin/monitoring/status');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true) {
        setIsMonitoring(!!serverPayload.data.isMonitoring);
        return;
      }
      if (typeof serverPayload?.isMonitoring === 'boolean') {
        setIsMonitoring(serverPayload.isMonitoring);
        return;
      }
      if (serverPayload?.error) {
        if (String(serverPayload.error).includes('401') || String(serverPayload.error).includes('403') || String(serverPayload.error).toLowerCase().includes('forbidden')) {
          setError('Serve ruolo admin per leggere /admin/monitoring/*');
          return;
        }
        setError(`Impossibile caricare /admin/monitoring/status: ${String(serverPayload.error)}`);
      }
    } catch (err) {
      console.error('Errore caricamento stato monitoraggio:', err);
    }
  };

  // Carica dettaglio spazio disco server app (top cartelle)
  const loadDiskBreakdown = async () => {
    try {
      const response = await apiRequest('GET', '/admin/monitoring/disk-breakdown?maxEntries=12');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true && serverPayload?.data?.entries) {
        setDiskBreakdown(serverPayload.data);
      }
    } catch (err) {
      // Non bloccare dashboard se breakdown non disponibile
      console.warn('Disk breakdown non disponibile:', err);
    }
  };

  const loadDatabaseDetails = async () => {
    try {
      const response = await apiRequest('GET', '/admin/monitoring/database');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true && serverPayload?.data) {
        setDatabaseDetails(serverPayload.data);
      }
    } catch (err) {
      console.warn('Database details non disponibili:', err);
    }
  };

  // Avvia/ferma monitoraggio
  const toggleMonitoring = async () => {
    try {
      setIsToggling(true);
      if (isMonitoring) {
        await apiRequest('POST', '/admin/monitoring/stop');
      } else {
        await apiRequest('POST', '/admin/monitoring/start', { intervalMs: 30000 });
      }
      // Aggiorna lo stato direttamente dal server, così il bottone cambia subito
      await loadMonitoringStatus();
    } catch (err) {
      console.error('Errore controllo monitoraggio:', err);
      setError((err as any)?.message || 'Errore controllo monitoraggio');
    } finally {
      setIsToggling(false);
    }
  };

  // Carica tutti i dati
  const loadAllData = async () => {
    // 1) Stato monitoraggio per primo: è la chiamata più importante per la UX del toggle.
    await loadMonitoringStatus();

    // 2) Le altre chiamate non devono bloccare tutta la pagina se una resta pending/errore.
    const results = await Promise.allSettled([
      loadSystemHealth(),
      loadPerformanceMetrics(),
      loadSummary(),
      loadDiskBreakdown(),
      loadDatabaseDetails()
    ]);

    const rejected = results.filter(r => r.status === 'rejected');
    if (rejected.length > 0 && !error) {
      setError('Alcune metriche non sono disponibili al momento. Riprova con "Aggiorna".');
    }
  };

  // Carica dati iniziali
  useEffect(() => {
    loadAllData();
  }, []);

  const getStatusColor = (status: string) => {
    const colors = {
      'OK': 'bg-green-100 text-green-800',
      'WARNING': 'bg-yellow-100 text-yellow-800',
      'ERROR': 'bg-red-100 text-red-800',
      'HEALTHY': 'bg-green-100 text-green-800',
      'DEGRADED': 'bg-yellow-100 text-yellow-800',
      'UNHEALTHY': 'bg-red-100 text-red-800',
      'CRITICAL': 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      'OK': CheckCircle,
      'WARNING': AlertTriangle,
      'ERROR': XCircle,
      'HEALTHY': CheckCircle,
      'DEGRADED': AlertTriangle,
      'UNHEALTHY': XCircle,
      'CRITICAL': XCircle
    };
    return icons[status as keyof typeof icons] || CheckCircle;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCheckDisplayName = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === 'disk') return 'Spazio disco (server app)';
    if (name === 'database') return 'Database (Neon)';
    if (name === 'memory') return 'Memoria server app';
    if (name === 'network') return 'Rete server app';
    if (name === 'services') return 'Servizi interni';
    if (name === 'security') return 'Sicurezza (eventi/log)';
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  };

  const getCheckHelpText = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === 'disk') return 'Indica il disco della macchina server (Render), non lo storage del database Neon.';
    if (name === 'database') return 'Indica la raggiungibilità/tempo risposta del database Neon.';
    if (name === 'memory') return 'Memoria RAM usata dal processo backend.';
    return null;
  };

  const getCheckSourceBadge = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === 'database') {
      return <Badge variant="outline" className="text-blue-700 border-blue-300">Fonte: Neon</Badge>;
    }
    return <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'N/D';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(2)} ${units[i]}`;
  };

  const currentView = location.includes('/monitoring-dashboard/health')
    ? 'health'
    : location.includes('/monitoring-dashboard/performance')
      ? 'performance'
      : location.includes('/monitoring-dashboard/disk')
        ? 'disk'
        : location.includes('/monitoring-dashboard/database')
          ? 'database'
          : location.includes('/monitoring-dashboard/memory')
            ? 'memory'
            : location.includes('/monitoring-dashboard/security')
              ? 'security'
              : location.includes('/monitoring-dashboard/services')
                ? 'services'
      : 'overview';

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-8 pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Monitoraggio Performance e Salute Sistema
        </h1>
        <p className="text-gray-600">
          Monitora le performance, la salute del sistema e rileva problemi proattivamente.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Nota: "Spazio disco" si riferisce al server applicativo (Render), non al database Neon.
        </p>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Controlli Monitoraggio */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Controlli Monitoraggio
            </span>
            <div className="flex items-center gap-2">
              <Badge className={isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {isMonitoring ? 'Attivo' : 'Inattivo'}
              </Badge>
              <Button 
                onClick={toggleMonitoring} 
                disabled={isToggling}
                variant={isMonitoring ? 'destructive' : 'default'}
              >
                {isMonitoring ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Ferma
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Avvia
                  </>
                )}
              </Button>
              <Button onClick={loadAllData} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <div className="grid w-full grid-cols-3 gap-2">
          <Link href="/monitoring-dashboard/overview">
            <Button variant={currentView === 'overview' ? 'default' : 'outline'} className="w-full">
              Panoramica
            </Button>
          </Link>
          <Link href="/monitoring-dashboard/health">
            <Button variant={currentView === 'health' ? 'default' : 'outline'} className="w-full">
              Salute Sistema
            </Button>
          </Link>
          <Link href="/monitoring-dashboard/performance">
            <Button variant={currentView === 'performance' ? 'default' : 'outline'} className="w-full">
              Performance
            </Button>
          </Link>
        </div>

        {/* PANORAMICA */}
        {currentView === 'overview' && (
          <div className="space-y-6">
          {/* Status Generale */}
          {systemHealth && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Stato Generale Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge className={getStatusColor(systemHealth.status)}>
                      {systemHealth.status}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {systemHealth.summary.passed} OK, {systemHealth.summary.warnings} Warning, {systemHealth.summary.failed} Errori
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(systemHealth.timestamp).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Riepilogo Performance */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">CPU Media</CardTitle>
                    <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                  </div>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.last24h.avgCpu}%
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {getTrendIcon(summary.trends.cpuTrend)}
                    <span className="ml-1">Ultime 24h</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Fonte: server app (Render)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Memoria Media</CardTitle>
                    <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                  </div>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.last24h.avgMemory} MB
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {getTrendIcon(summary.trends.memoryTrend)}
                    <span className="ml-1">Ultime 24h</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Fonte: server app (Render)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Errori</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {summary.last24h.totalErrors}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {getTrendIcon(summary.trends.errorTrend)}
                    <span className="ml-1">Ultime 24h</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {summary.last24h.healthStatus.uptime}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Salute sistema
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          </div>
        )}

        {/* SALUTE SISTEMA */}
        {currentView === 'health' && (
          <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Come leggere "Spazio disco"</CardTitle>
              <CardDescription>
                "Spazio disco" indica il filesystem del server backend su Render, non il database Neon.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <p>- Fonte: server applicativo (Render)</p>
              <p>- Non misura lo storage del DB Neon</p>
              <p>- Se vedi "(stima)", il valore usa un fallback meno accurato</p>
            </CardContent>
          </Card>
          {systemHealth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(systemHealth.checks).map(([name, check]) => {
                const IconComponent = getStatusIcon(check.status);
                
                const cardContent = (
                  <Card key={name}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 justify-between">
                        <span className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" />
                          {getCheckDisplayName(name)}
                        </span>
                        {getCheckSourceBadge(name)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={getStatusColor(check.status)}>
                            {check.status}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(check.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{check.message}</p>
                        {getCheckHelpText(name) && (
                          <p className="text-xs text-gray-500">{getCheckHelpText(name)}</p>
                        )}
                        {check.responseTime && (
                          <p className="text-xs text-gray-500">
                            Tempo risposta: {check.responseTime}
                          </p>
                        )}
                        {name.toLowerCase() === 'disk' && (
                          <div className="text-xs text-gray-500 space-y-1 pt-1 border-t">
                            <p><strong>Origine:</strong> {check.sourceLabel || 'Server applicativo (Render) - NON Neon'}</p>
                            <p>
                              <strong>Utilizzato:</strong> {formatBytes(check.usedBytes)} / {formatBytes(check.totalBytes)}
                              {' '}({typeof check.diskPercent === 'number' ? `${check.diskPercent.toFixed(2)}%` : 'N/D'})
                            </p>
                            <p><strong>Disponibile:</strong> {formatBytes(check.freeBytes || check.freeSpace)}</p>
                            <p><strong>Metodo:</strong> {check.method === 'df' ? 'misura reale filesystem' : 'stima (fallback)'}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
                const lowerName = name.toLowerCase();
                const detailsPathMap: Record<string, string> = {
                  disk: '/monitoring-dashboard/disk',
                  database: '/monitoring-dashboard/database',
                  memory: '/monitoring-dashboard/memory',
                  security: '/monitoring-dashboard/security',
                  services: '/monitoring-dashboard/services'
                };
                const detailsPath = detailsPathMap[lowerName];

                return detailsPath
                  ? (
                    <Link key={name} href={detailsPath} className="block">
                      <div className="cursor-pointer hover:opacity-95 transition-opacity" title="Apri dettaglio spazio disco">
                        {cardContent}
                      </div>
                    </Link>
                  )
                  : cardContent;
              })}
            </div>
          )}
          </div>
        )}

        {currentView === 'disk' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Breakdown spazio disco server app
                </CardTitle>
                <CardDescription>
                  Questa vista mostra il filesystem del server applicativo Render (NON Neon).
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>- Origine: server backend Render</p>
                <p>- Esclude il database Neon (storage separato)</p>
                <p>- Clicca "Aggiorna" per ricaricare il breakdown</p>
              </CardContent>
            </Card>

            {diskBreakdown ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5" />
                      Top cartelle più pesanti
                    </span>
                    <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                  </CardTitle>
                  <CardDescription>
                    Target: <code>{diskBreakdown.target}</code> | Totale: {diskBreakdown.totalHuman}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-3">Cartella</th>
                          <th className="py-2 pr-3">Dimensione</th>
                          <th className="py-2 pr-3">% sul totale target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diskBreakdown.entries.map((entry) => (
                          <tr key={entry.path} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs md:text-sm">{entry.path}</td>
                            <td className="py-2 pr-3">{entry.sizeHuman}</td>
                            <td className="py-2 pr-3">{entry.percentOfTarget.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Dati non disponibili</AlertTitle>
                <AlertDescription>
                  Breakdown spazio disco non disponibile al momento. Premi "Aggiorna" per riprovare.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {currentView === 'database' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Approfondimento Database (Neon)
                  </span>
                  <Badge variant="outline" className="text-blue-700 border-blue-300">Fonte: Neon</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p><strong>Connessioni totali:</strong> {databaseDetails?.connections?.total_connections ?? 'N/D'}</p>
                  <p><strong>Connessioni attive:</strong> {databaseDetails?.connections?.active_connections ?? 'N/D'}</p>
                  <p><strong>Connessioni idle:</strong> {databaseDetails?.connections?.idle_connections ?? 'N/D'}</p>
                  <p><strong>Idle in transaction:</strong> {databaseDetails?.connections?.idle_in_transaction ?? 'N/D'}</p>
                </div>
                <div className="space-y-1">
                  <p><strong>Dimensione DB:</strong> {databaseDetails?.size?.database_size ?? 'N/D'}</p>
                  <p><strong>Tabella users:</strong> {databaseDetails?.size?.users_table_size ?? 'N/D'}</p>
                  <p><strong>Dimensione users (bytes):</strong> {databaseDetails?.size?.users_table_size_bytes ?? 'N/D'}</p>
                </div>
              </CardContent>
            </Card>
            {databaseDetails?.slowQueries?.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>Slow Queries (top)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-3">Query</th>
                          <th className="py-2 pr-3">Mean ms</th>
                          <th className="py-2 pr-3">Calls</th>
                          <th className="py-2 pr-3">Total ms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {databaseDetails.slowQueries.map((q, i) => (
                          <tr key={`${q.query}-${i}`} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs">{q.query}</td>
                            <td className="py-2 pr-3">{Number(q.mean_exec_time || 0).toFixed(2)}</td>
                            <td className="py-2 pr-3">{q.calls ?? 0}</td>
                            <td className="py-2 pr-3">{Number(q.total_exec_time || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {currentView === 'memory' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Approfondimento Memoria server app
                  </span>
                  <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Heap Used:</strong> {formatBytes(performanceMetrics?.memory?.heapUsed)}</p>
                <p><strong>Heap Total:</strong> {formatBytes(performanceMetrics?.memory?.heapTotal)}</p>
                <p><strong>RSS:</strong> {formatBytes(performanceMetrics?.memory?.rss)}</p>
                <p><strong>System Free:</strong> {formatBytes(performanceMetrics?.memory?.systemFree)}</p>
                <p><strong>System Used:</strong> {formatBytes(performanceMetrics?.memory?.systemUsed)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'security' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Approfondimento Sicurezza (eventi/log)
                  </span>
                  <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render/Axiom</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p><strong>Stato:</strong> {systemHealth?.checks?.security?.status ?? 'N/D'}</p>
                <p><strong>Messaggio:</strong> {systemHealth?.checks?.security?.message ?? 'N/D'}</p>
                <p className="text-gray-500 mt-2">
                  Per analisi estesa usa anche la dashboard sicurezza amministrativa.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'services' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Approfondimento Servizi interni
                  </span>
                  <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p><strong>Stato:</strong> {systemHealth?.checks?.services?.status ?? 'N/D'}</p>
                <p><strong>Messaggio:</strong> {systemHealth?.checks?.services?.message ?? 'N/D'}</p>
                {systemHealth?.checks?.services?.failedServices?.length > 0 && (
                  <p><strong>Servizi non operativi:</strong> {systemHealth.checks.services.failedServices.join(', ')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'performance' && (
          <div className="space-y-6">
            {performanceMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      CPU
                    </span>
                    <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                  </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Utilizzo:</span>
                        <span className="font-mono">
                          {performanceMetrics.application.cpuUsage?.percent?.toFixed(2) || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>User Time:</span>
                        <span className="font-mono">
                          {performanceMetrics.application.cpuUsage?.user?.toFixed(2) || 0}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>System Time:</span>
                        <span className="font-mono">
                          {performanceMetrics.application.cpuUsage?.system?.toFixed(2) || 0}ms
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5" />
                      Memoria
                    </span>
                    <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                  </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Heap Used:</span>
                        <span className="font-mono">
                          {(performanceMetrics.memory.heapUsed / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Heap Total:</span>
                        <span className="font-mono">
                          {(performanceMetrics.memory.heapTotal / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>RSS:</span>
                        <span className="font-mono">
                          {(performanceMetrics.memory.rss / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sistema Free:</span>
                        <span className="font-mono">
                          {(performanceMetrics.memory.systemFree / 1024 / 1024 / 1024).toFixed(2)} GB
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                    Database (Neon)
                    </span>
                    <Badge variant="outline" className="text-blue-700 border-blue-300">Fonte: Neon</Badge>
                  </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Connessioni Attive:</span>
                        <span className="font-mono">
                          {performanceMetrics.database.activeConnections || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Connessioni Idle:</span>
                        <span className="font-mono">
                          {performanceMetrics.database.idleConnections || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dimensione DB:</span>
                        <span className="font-mono">
                          {performanceMetrics.database.databaseSize || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Applicazione
                    </span>
                    <Badge variant="outline" className="text-violet-700 border-violet-300">Fonte: Render</Badge>
                  </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Uptime:</span>
                        <span className="font-mono">
                          {Math.floor(performanceMetrics.system.uptime / 3600)}h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Event Loop Delay:</span>
                        <span className="font-mono">
                          {performanceMetrics.application.eventLoopDelay?.toFixed(2) || 0}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Handles:</span>
                        <span className="font-mono">
                          {performanceMetrics.application.activeHandles || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Requests:</span>
                        <span className="font-mono">
                          {performanceMetrics.application.activeRequests || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitoringDashboard;
