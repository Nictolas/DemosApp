// File: client/src/pages/MonitoringDashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  ShieldCheck
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
  const startedByThisPageRef = useRef(false);

  // Intervallo più “gentile” in produzione: abbastanza per osservare senza tenere sempre sveglio il DB.
  // Puoi sempre ridurlo manualmente dal bottone “Avvia” se necessario.
  const MONITORING_INTERVAL_MS = 120000;

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
        startedByThisPageRef.current = false;
      } else {
        await apiRequest('POST', '/admin/monitoring/start', { intervalMs: MONITORING_INTERVAL_MS });
        startedByThisPageRef.current = true;
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
    let mounted = true;
    (async () => {
      await loadAllData();

      // On-demand: se il monitor non è attivo, lo avviamo automaticamente quando apri la dashboard.
      // Questo evita di tenerlo sempre acceso lato backend in produzione.
      try {
        const response = await apiRequest('GET', '/admin/monitoring/status');
        const serverPayload = response?.data ?? response;
        const currentlyMonitoring =
          serverPayload?.success === true ? !!serverPayload.data?.isMonitoring :
          typeof serverPayload?.isMonitoring === 'boolean' ? serverPayload.isMonitoring :
          false;

        if (mounted && !currentlyMonitoring) {
          await apiRequest('POST', '/admin/monitoring/start', { intervalMs: MONITORING_INTERVAL_MS });
          startedByThisPageRef.current = true;
          await loadMonitoringStatus();
        }
      } catch (_e) {
        // Se non riesce ad avviare (es. non admin), non bloccare la pagina.
      }
    })();

    return () => {
      mounted = false;
      // Se questa pagina ha avviato il monitor, lo fermiamo quando esci per ridurre compute.
      if (startedByThisPageRef.current) {
        apiRequest('POST', '/admin/monitoring/stop').catch(() => {});
      }
    };
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
    if (name === 'database') return 'Database (Supabase)';
    if (name === 'memory') return 'Memoria server app';
    if (name === 'network') return 'Rete server app';
    if (name === 'services') return 'Servizi interni';
    if (name === 'security') return 'Sicurezza (eventi/log)';
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  };

  const getCheckHelpText = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === 'disk') return 'Indica il disco della macchina server (Render), non lo storage del database Supabase.';
    if (name === 'database') return 'Indica la raggiungibilità/tempo risposta del database Supabase.';
    if (name === 'memory') return 'Memoria RAM usata dal processo backend.';
    return null;
  };

  const getCheckSourceBadge = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === 'database') {
      return <Badge variant="outline" className="text-blue-700 border-blue-300">Fonte: Supabase</Badge>;
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

  const viewMeta: Record<string, { title: string; subtitle: string }> = {
    overview: { title: 'Panoramica', subtitle: 'KPI principali e stato generale del sistema' },
    health: { title: 'Salute Sistema', subtitle: 'Controlli su servizi, rete, memoria e database' },
    performance: { title: 'Performance', subtitle: 'Dettaglio risorse applicative e trend runtime' },
    disk: { title: 'Spazio Disco', subtitle: 'Analisi filesystem server applicativo Render' },
    database: { title: 'Database', subtitle: 'Connessioni, dimensioni e query lente (Supabase)' },
    memory: { title: 'Memoria', subtitle: 'Heap, RSS e consumo memoria del backend' },
    security: { title: 'Sicurezza', subtitle: 'Eventi, stato controlli e indicatori sicurezza' },
    services: { title: 'Servizi', subtitle: 'Stato dei servizi interni e disponibilita componenti' }
  };

  const navItems = [
    { key: 'overview', label: 'Panoramica', href: '/monitoring-dashboard/overview', icon: BarChart3 },
    { key: 'health', label: 'Salute Sistema', href: '/monitoring-dashboard/health', icon: Heart },
    { key: 'performance', label: 'Performance', href: '/monitoring-dashboard/performance', icon: Activity }
  ] as const;

  const surfaceCardClass = 'border-slate-200/70 bg-white/85 backdrop-blur-sm shadow-sm';
  const sectionCardClass = 'border-slate-200/70 bg-white/90 shadow-sm';
  const tableHeadClass = 'text-left border-b bg-slate-50 text-slate-700';
  const tableRowClass = 'border-b last:border-0 hover:bg-slate-50/70 transition-colors';

  return (
    <div className="w-full mx-auto px-4 md:px-8 py-8 pt-20 min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef2ff_0%,_#f8fbff_38%,_#ffffff_72%)]">
      <div className={`mb-6 rounded-2xl p-5 md:p-6 ${surfaceCardClass}`}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Ops Monitoring Hub
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-3 flex items-center gap-2 text-slate-900">
          <Activity className="h-8 w-8 text-indigo-600" />
          Monitoring Dashboard
        </h1>
        <p className="text-slate-600 max-w-4xl">
          Vista unificata per monitorare performance, salute piattaforma e segnali di rischio in modo rapido e leggibile.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Nota: "Spazio disco" si riferisce al server applicativo (Render), non al database Supabase.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
          <Clock className="h-3.5 w-3.5" />
          <span>{viewMeta[currentView]?.title}</span>
          <span className="text-slate-400">-</span>
          <span>{viewMeta[currentView]?.subtitle}</span>
        </div>
      </div>

      {error && (
        <Alert className="mb-6 border-amber-200 bg-amber-50/80">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Controlli Monitoraggio */}
      <Card className={`mb-6 ${surfaceCardClass}`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="flex items-center gap-2 text-slate-900">
              <Zap className="h-5 w-5" />
              Controlli Monitoraggio
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={isMonitoring ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}>
                {isMonitoring ? 'Attivo' : 'Inattivo'}
              </Badge>
              <Button 
                onClick={toggleMonitoring} 
                disabled={isToggling}
                variant={isMonitoring ? 'destructive' : 'default'}
                className="shadow-sm"
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
              <Button onClick={loadAllData} disabled={loading} variant="outline" className="border-slate-300">
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 p-1 rounded-xl border border-slate-200/70 bg-white/80 backdrop-blur-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href}>
                <Button variant={currentView === item.key ? 'default' : 'ghost'} className="w-full rounded-lg justify-start sm:justify-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* PANORAMICA */}
        {currentView === 'overview' && (
          <div className="space-y-6">
          <Card className={surfaceCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Come leggere la Panoramica</CardTitle>
              <CardDescription>
                Spiegazione veloce, non tecnica, dei numeri principali che vedi in questa schermata.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
              <div className="space-y-2">
                <p><strong>CPU Media:</strong> quanto il server ha lavorato nelle ultime 24 ore. Se resta alta a lungo, il sistema e sotto carico.</p>
                <p><strong>Memoria Media:</strong> quanta RAM ha usato il backend nelle ultime 24 ore. Se cresce troppo, possono arrivare rallentamenti.</p>
              </div>
              <div className="space-y-2">
                <p><strong>Errori:</strong> numero totale errori nelle ultime 24 ore. Se aumenta, c'e un problema da analizzare.</p>
                <p><strong>Uptime:</strong> quanto il servizio e rimasto attivo senza interruzioni. Piu e alto, maggiore e la stabilita.</p>
              </div>
            </CardContent>
          </Card>

          {/* Status Generale */}
          {systemHealth && (
            <Card className={surfaceCardClass}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={sectionCardClass}>
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

              <Card className={sectionCardClass}>
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

              <Card className={sectionCardClass}>
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

              <Card className={sectionCardClass}>
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
          <Card className={surfaceCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Come leggere "Spazio disco"</CardTitle>
              <CardDescription>
                "Spazio disco" indica il filesystem del server backend su Render, non il database Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <p>- Fonte: server applicativo (Render)</p>
              <p>- Non misura lo storage del DB Supabase</p>
              <p>- Se vedi "(stima)", il valore usa un fallback meno accurato</p>
            </CardContent>
          </Card>
          {systemHealth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(systemHealth.checks).map(([name, check]) => {
                const IconComponent = getStatusIcon(check.status);
                
                const cardContent = (
                  <Card key={name} className={`${sectionCardClass} hover:shadow-md transition-shadow`}>
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
                            <p><strong>Origine:</strong> {check.sourceLabel || 'Server applicativo (Render) - NON Supabase'}</p>
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
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Breakdown spazio disco server app
                </CardTitle>
                <CardDescription>
                  Questa vista mostra il filesystem del server applicativo Render (NON Supabase).
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>- Origine: server backend Render</p>
                <p>- Esclude il database Supabase (storage separato)</p>
                <p>- Clicca "Aggiorna" per ricaricare il breakdown</p>
              </CardContent>
            </Card>

            {diskBreakdown ? (
              <Card className={sectionCardClass}>
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
                        <tr className={tableHeadClass}>
                          <th className="py-2 pr-3">Cartella</th>
                          <th className="py-2 pr-3">Dimensione</th>
                          <th className="py-2 pr-3">% sul totale target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diskBreakdown.entries.map((entry) => (
                          <tr key={entry.path} className={tableRowClass}>
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
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="text-base">Come leggere i dati Database</CardTitle>
                <CardDescription>
                  Guida rapida, in linguaggio semplice, per capire a cosa servono le voci di questa pagina.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                <div className="space-y-2">
                  <p><strong>Connessioni totali:</strong> quante connessioni al DB sono aperte in questo momento.</p>
                  <p><strong>Connessioni attive:</strong> quante stanno lavorando adesso (query in corso).</p>
                  <p><strong>Connessioni idle:</strong> quante sono aperte ma ferme, in attesa di lavoro.</p>
                  <p><strong>Idle in transaction:</strong> connessioni lasciate in transazione senza chiuderla; se sale troppo, e un campanello d'allarme.</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Dimensione DB:</strong> quanto spazio occupa l'intero database Supabase.</p>
                  <p><strong>Tabella users:</strong> quanto spazio usa solo la tabella utenti.</p>
                  <p><strong>Dimensione users (bytes):</strong> la stessa misura in formato numerico grezzo.</p>
                  <p><strong>Slow queries:</strong> query lente; servono per capire dove ottimizzare e ridurre carico/compute.</p>
                </div>
              </CardContent>
            </Card>

            <Card className={sectionCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Approfondimento Database (Supabase)
                  </span>
                  <Badge variant="outline" className="text-blue-700 border-blue-300">Fonte: Supabase</Badge>
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
              <Card className={sectionCardClass}>
                <CardHeader>
                  <CardTitle>Slow Queries (top)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={tableHeadClass}>
                          <th className="py-2 pr-3">Query</th>
                          <th className="py-2 pr-3">Mean ms</th>
                          <th className="py-2 pr-3">Calls</th>
                          <th className="py-2 pr-3">Total ms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {databaseDetails.slowQueries.map((q, i) => (
                          <tr key={`${q.query}-${i}`} className={tableRowClass}>
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
            <Card className={sectionCardClass}>
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
            <Card className={sectionCardClass}>
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
            <Card className={sectionCardClass}>
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
                  <p><strong>Servizi non operativi:</strong> {systemHealth?.checks?.services?.failedServices?.join(', ')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'performance' && (
          <div className="space-y-6">
            <Card className={surfaceCardClass}>
              <CardHeader>
                <CardTitle className="text-base">Come leggere la sezione Performance</CardTitle>
                <CardDescription>
                  Guida rapida, in parole semplici, per interpretare i numeri tecnici di questa pagina.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                <div className="space-y-2">
                  <p><strong>CPU:</strong> misura quanto lavora il server. Se resta spesso alta, il sistema e sotto pressione.</p>
                  <p><strong>Memoria:</strong> indica quanta RAM usa l'app. Se cresce continuamente, puo esserci un consumo anomalo.</p>
                  <p><strong>Database:</strong> mostra connessioni e dimensioni del DB Supabase; utile per capire se il DB e il collo di bottiglia.</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Uptime:</strong> da quanto tempo l'app e attiva senza riavvii.</p>
                  <p><strong>Event Loop Delay:</strong> se alto, l'app risponde piu lentamente alle richieste.</p>
                  <p><strong>Active Handles/Requests:</strong> quante operazioni sono aperte in quel momento; picchi prolungati indicano carico elevato.</p>
                </div>
              </CardContent>
            </Card>

            {performanceMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className={sectionCardClass}>
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

                <Card className={sectionCardClass}>
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

                <Card className={sectionCardClass}>
                  <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                    Database (Supabase)
                    </span>
                    <Badge variant="outline" className="text-blue-700 border-blue-300">Fonte: Supabase</Badge>
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

                <Card className={sectionCardClass}>
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
