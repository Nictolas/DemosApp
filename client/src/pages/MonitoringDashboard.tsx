// File: client/src/pages/MonitoringDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const MonitoringDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Carica stato salute sistema
  const loadSystemHealth = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/admin/monitoring/health');
      const serverPayload = response?.data ?? response;
      if (serverPayload?.success === true) {
        setSystemHealth(serverPayload.data);
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
        setPerformanceMetrics(serverPayload.data.metrics);
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
        setSummary(serverPayload.data);
        return;
      }
      if (serverPayload?.last24h) {
        setSummary(serverPayload);
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
    } catch (err) {
      console.error('Errore caricamento stato monitoraggio:', err);
    }
  };

  // Avvia/ferma monitoraggio
  const toggleMonitoring = async () => {
    try {
      setLoading(true);
      if (isMonitoring) {
        await apiRequest('POST', '/admin/monitoring/stop');
        setIsMonitoring(false);
      } else {
        await apiRequest('POST', '/admin/monitoring/start', { intervalMs: 30000 });
        setIsMonitoring(true);
      }
    } catch (err) {
      setError('Errore controllo monitoraggio');
    } finally {
      setLoading(false);
    }
  };

  // Carica tutti i dati
  const loadAllData = async () => {
    await Promise.all([
      loadSystemHealth(),
      loadPerformanceMetrics(),
      loadSummary(),
      loadMonitoringStatus()
    ]);
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Monitoraggio Performance e Salute Sistema
        </h1>
        <p className="text-gray-600">
          Monitora le performance, la salute del sistema e rileva problemi proattivamente.
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
                disabled={loading}
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="health">Salute Sistema</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alert e Log</TabsTrigger>
        </TabsList>

        {/* PANORAMICA */}
        <TabsContent value="overview" className="space-y-6">
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
                  <CardTitle className="text-sm font-medium">CPU Media</CardTitle>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Memoria Media</CardTitle>
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
        </TabsContent>

        {/* SALUTE SISTEMA */}
        <TabsContent value="health" className="space-y-6">
          {systemHealth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(systemHealth.checks).map(([name, check]) => {
                const IconComponent = getStatusIcon(check.status);
                
                return (
                  <Card key={name}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconComponent className="h-5 w-5" />
                        {name.charAt(0).toUpperCase() + name.slice(1)}
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
                        {check.responseTime && (
                          <p className="text-xs text-gray-500">
                            Tempo risposta: {check.responseTime}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* PERFORMANCE */}
        <TabsContent value="performance" className="space-y-6">
          {performanceMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    CPU
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
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Memoria
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
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database
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
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Applicazione
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
        </TabsContent>

        {/* ALERT E LOG */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alert Recenti
              </CardTitle>
              <CardDescription>
                Ultimi alert e warning del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Caricamento alert in corso...</p>
                <p className="text-sm">Questa sezione mostrerà gli alert più recenti</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;
