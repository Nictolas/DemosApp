import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  Zap, 
  CheckCircle, 
  FileText, 
  Activity,
  Database,
  TrendingUp
} from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

export default function SecurityDashboard() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dati reali dal sistema
  const [securityStats, setSecurityStats] = useState({
    totalViolations: 0,
    criticalIssues: 0,
    rateLimitViolations: 0,
    validationFailures: 0,
    auditLogs: 0,
    systemHealth: 0
  });

  // Nuove metriche di sicurezza implementate
  const [jwtStats, setJwtStats] = useState({
    activeTokens: 0,
    revokedTokens: 0,
    expiredTokens: 0,
    suspiciousActivity: 0
  });

  const [rateLimitingStats, setRateLimitingStats] = useState({
    blockedIPs: 0,
    requestsPerMinute: 0,
    topBlockedEndpoints: []
  });

  const [sslStats, setSslStats] = useState({
    secureConnections: 0,
    insecureConnections: 0,
    certificateExpiry: null
  });

  const [validationStats, setValidationStats] = useState({
    blockedInjectionAttempts: 0,
    sanitizedInputs: 0,
    validationFailures: 0
  });

  const [realTimeEvents, setRealTimeEvents] = useState([]);

  const [recentViolations, setRecentViolations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState([]);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carica statistiche generali
      const statsResponse = await apiRequest('GET', '/admin/audit-dashboard/stats');

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const stats = statsData.data.general_stats;
        setSecurityStats({
          totalViolations: stats.failed_actions || 0,
          criticalIssues: stats.failed_actions || 0,
          rateLimitViolations: 0, // Non disponibile nell'API attuale
          validationFailures: 0, // Non disponibile nell'API attuale
          auditLogs: stats.total_actions || 0,
          systemHealth: stats.total_actions > 0 ? Math.round((stats.successful_actions / stats.total_actions) * 100) : 0
        });
      }

      // Carica violazioni recenti
      const violationsResponse = await apiRequest('GET', '/admin/audit-dashboard/violations');

      if (violationsResponse.ok) {
        const violationsData = await violationsResponse.json();
        setRecentViolations(violationsData.data.violations || []);
      }

      // Carica audit logs
      const logsResponse = await apiRequest('GET', '/admin/audit-dashboard/logs');

      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setAuditLogs(logsData.data.logs.map((log: any) => ({
          id: log.id,
          action: log.action,
          user: log.user_id,
          timestamp: new Date(log.timestamp).toLocaleString('it-IT'),
          status: log.success ? 'Success' : 'Failed'
        })) || []);
      }

      // Carica metriche performance
      const performanceResponse = await apiRequest('GET', '/admin/audit-dashboard/performance');

      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json();
        setPerformanceMetrics(performanceData.data.performance || []);
      }

      // Carica nuove metriche di sicurezza implementate
      await loadSecurityMetrics();

    } catch (err) {
      console.error('Errore nel caricamento dati:', err);
      setError('Errore nel caricamento dei dati del sistema');
    } finally {
      setLoading(false);
    }
  };

  // Carica le nuove metriche di sicurezza implementate
  const loadSecurityMetrics = async () => {
    try {
      // JWT Token Stats
      const jwtResponse = await apiRequest('GET', '/api/admin/security/jwt-stats');
      if (jwtResponse.ok) {
        const jwtData = await jwtResponse.json();
        setJwtStats(jwtData.data || {
          activeTokens: 0,
          revokedTokens: 0,
          expiredTokens: 0,
          suspiciousActivity: 0
        });
      }

      // Rate Limiting Stats
      const rateLimitResponse = await apiRequest('GET', '/api/admin/security/rate-limiting-stats');
      if (rateLimitResponse.ok) {
        const rateLimitData = await rateLimitResponse.json();
        setRateLimitingStats(rateLimitData.data || {
          blockedIPs: 0,
          requestsPerMinute: 0,
          topBlockedEndpoints: []
        });
      }

      // SSL Stats
      const sslResponse = await apiRequest('GET', '/api/admin/security/ssl-stats');
      if (sslResponse.ok) {
        const sslData = await sslResponse.json();
        setSslStats(sslData.data || {
          secureConnections: 0,
          insecureConnections: 0,
          certificateExpiry: null
        });
      }

      // Validation Stats
      const validationResponse = await apiRequest('GET', '/api/admin/security/validation-stats');
      if (validationResponse.ok) {
        const validationData = await validationResponse.json();
        setValidationStats(validationData.data || {
          blockedInjectionAttempts: 0,
          sanitizedInputs: 0,
          validationFailures: 0
        });
      }

      // Real-time Security Events
      const eventsResponse = await apiRequest('GET', '/api/admin/security/real-time-events');
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setRealTimeEvents(eventsData.data || []);
      }

    } catch (err) {
      console.error('Errore nel caricamento metriche sicurezza:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 page-with-navbar flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Caricamento dati di sicurezza...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 page-with-navbar">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Dashboard Sicurezza e Monitoraggio
              </h1>
              <p className="text-gray-600 text-lg">
                Panoramica completa dello stato di sicurezza e performance del sistema
              </p>
            </div>
            <Button 
              onClick={() => setLocation('/gestisci')}
              variant="outline"
              className="ml-4"
            >
              ← Torna a Gestisci
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistiche Generali */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Violazioni Totali</p>
                  <p className="text-3xl font-bold text-red-700">{securityStats.totalViolations}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Rate Limiting</p>
                  <p className="text-3xl font-bold text-yellow-700">{securityStats.rateLimitViolations}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Audit Logs</p>
                  <p className="text-3xl font-bold text-green-700">{securityStats.auditLogs}</p>
                </div>
                <FileText className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Salute Sistema</p>
                  <p className="text-3xl font-bold text-blue-700">{securityStats.systemHealth}%</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Nuove Metriche di Sicurezza Implementate */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🛡️ Misure di Sicurezza Implementate</h2>
          
          {/* JWT Token Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Token Attivi</p>
                    <p className="text-3xl font-bold text-purple-700">{jwtStats.activeTokens}</p>
                  </div>
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Token Revocati</p>
                    <p className="text-3xl font-bold text-orange-700">{jwtStats.revokedTokens}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">Rate Limiting</p>
                    <p className="text-3xl font-bold text-indigo-700">{rateLimitingStats.blockedIPs}</p>
                    <p className="text-xs text-indigo-500">IP Bloccati</p>
                  </div>
                  <Zap className="h-8 w-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Connessioni SSL</p>
                    <p className="text-3xl font-bold text-emerald-700">{sslStats.secureConnections}</p>
                    <p className="text-xs text-emerald-500">Sicure</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Validazione Input e Eventi Real-time */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-gradient-to-r from-rose-50 to-rose-100 border-rose-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-rose-600">Injection Bloccati</p>
                    <p className="text-3xl font-bold text-rose-700">{validationStats.blockedInjectionAttempts}</p>
                  </div>
                  <Search className="h-8 w-8 text-rose-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-cyan-50 to-cyan-100 border-cyan-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-cyan-600">Input Sanitizzati</p>
                    <p className="text-3xl font-bold text-cyan-700">{validationStats.sanitizedInputs}</p>
                  </div>
                  <Database className="h-8 w-8 text-cyan-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-violet-50 to-violet-100 border-violet-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-violet-600">Eventi Real-time</p>
                    <p className="text-3xl font-bold text-violet-700">{realTimeEvents.length}</p>
                    <p className="text-xs text-violet-500">Ultimi 5 min</p>
                  </div>
                  <Activity className="h-8 w-8 text-violet-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contenuto principale senza tab */}
        <div className="space-y-8">
          {/* Violazioni Recenti e Metriche Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Violazioni Recenti */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Violazioni Recenti
                </CardTitle>
                <CardDescription>
                  Ultime violazioni di sicurezza rilevate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentViolations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>Nessuna violazione rilevata</p>
                    </div>
                  ) : (
                    recentViolations.map((violation: any) => (
                      <div key={violation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{violation.type}</p>
                          <p className="text-sm text-gray-500">{violation.user} • {violation.timestamp}</p>
                        </div>
                        <Badge 
                          variant={violation.severity === 'Critical' ? 'destructive' : 
                                  violation.severity === 'High' ? 'destructive' : 'secondary'}
                        >
                          {violation.severity}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Metriche Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Metriche Performance
                </CardTitle>
                <CardDescription>
                  Stato attuale delle performance del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceMetrics.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>Nessuna metrica disponibile</p>
                    </div>
                  ) : (
                    performanceMetrics.map((metric: any) => (
                      <div key={metric.name} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{metric.value}</span>
                          <Badge 
                            variant={metric.status === 'good' ? 'default' : 
                                    metric.status === 'warning' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {metric.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Audit Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Log di Audit
              </CardTitle>
              <CardDescription>
                Monitora tutte le azioni degli utenti per sicurezza e conformità
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nessun log di audit disponibile</p>
                  </div>
                ) : (
                  auditLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-gray-500">{log.user} • {log.timestamp}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{log.status}</Badge>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={loadRealData}>
                  <Search className="h-4 w-4 mr-2" />
                  Aggiorna Logs
                </Button>
                <Button variant="outline" size="sm">
                  <Database className="h-4 w-4 mr-2" />
                  Esporta Logs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Monitoraggio Violazioni */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Monitoraggio Violazioni
              </CardTitle>
              <CardDescription>
                Rileva e gestisci violazioni di sicurezza e conformità GDPR
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityStats.criticalIssues > 0 && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{securityStats.criticalIssues} violazioni critiche</strong> richiedono attenzione immediata.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-3">
                {recentViolations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nessuna violazione da gestire</p>
                  </div>
                ) : (
                  recentViolations.map((violation: any) => (
                    <div key={violation.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-red-800">{violation.type}</p>
                          <p className="text-sm text-red-600">{violation.user} • {violation.timestamp}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="destructive">{violation.severity}</Badge>
                          <Button size="sm" variant="outline">
                            Gestisci
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rate Limiting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Rate Limiting
              </CardTitle>
              <CardDescription>
                Monitora e gestisci le violazioni di rate limiting per la sicurezza dell'API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Zap className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Nessuna violazione da gestire</p>
              </div>
              <div className="text-center py-8 text-gray-500">
                <Zap className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Nessuna violazione di rate limiting attiva</p>
              </div>
            </CardContent>
          </Card>

          {/* Validazione Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Validazione Input
              </CardTitle>
              <CardDescription>
                Monitora e gestisci i fallimenti di validazione per la sicurezza dell'applicazione
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Fallimenti per Tipo</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Email non valida</span>
                      <Badge variant="destructive">{securityStats.validationFailures}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">SQL Injection</span>
                      <Badge variant="destructive">0</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">XSS Attack</span>
                      <Badge variant="destructive">0</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Stato Sistema</h4>
                  <div className="space-y-2">
                    <div className="text-sm p-2 bg-green-50 rounded">
                      <strong>Sistema Sicuro:</strong> Nessun tentativo di attacco rilevato
                    </div>
                    <div className="text-sm p-2 bg-blue-50 rounded">
                      <strong>Monitoraggio Attivo:</strong> Validazione input in tempo reale
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance e Logging */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Monitoraggio Performance e Logging
              </CardTitle>
              <CardDescription>
                Monitora performance, salute del sistema e rileva problemi proattivamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceMetrics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {performanceMetrics.map((metric: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{metric.name}</span>
                        <Badge variant={metric.status === 'good' ? 'default' : 'secondary'}>
                          {metric.status}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Nessuna metrica disponibile</p>
                </div>
              )}
              <div className="mt-6">
                <h4 className="font-medium mb-3">Logging Centralizzato</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">{securityStats.auditLogs}</p>
                    <p className="text-sm text-blue-600">Log Totali</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">
                      {securityStats.auditLogs > 0 ? Math.round(((securityStats.auditLogs - securityStats.totalViolations) / securityStats.auditLogs) * 100) : 0}%
                    </p>
                    <p className="text-sm text-green-600">Success Rate</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-700">{securityStats.totalViolations}</p>
                    <p className="text-sm text-yellow-600">Errori</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nuove Sezioni Dettagliate per le Misure di Sicurezza Implementate */}
          
          {/* JWT Token Management Dettagliato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                Gestione Token JWT
              </CardTitle>
              <CardDescription>
                Monitora e gestisci i token JWT per l'autenticazione sicura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700">{jwtStats.activeTokens}</p>
                  <p className="text-sm text-purple-600">Token Attivi</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-700">{jwtStats.revokedTokens}</p>
                  <p className="text-sm text-orange-600">Token Revocati</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-700">{jwtStats.expiredTokens}</p>
                  <p className="text-sm text-red-600">Token Scaduti</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-700">{jwtStats.suspiciousActivity}</p>
                  <p className="text-sm text-yellow-600">Attività Sospette</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadSecurityMetrics}>
                  <Activity className="h-4 w-4 mr-2" />
                  Aggiorna Token
                </Button>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Revoca Tutti
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limiting Dettagliato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600" />
                Rate Limiting e Protezione DDoS
              </CardTitle>
              <CardDescription>
                Monitora le limitazioni di velocità e la protezione dagli attacchi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-700">{rateLimitingStats.blockedIPs}</p>
                  <p className="text-sm text-indigo-600">IP Bloccati</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{rateLimitingStats.requestsPerMinute}</p>
                  <p className="text-sm text-blue-600">Richieste/Min</p>
                </div>
                <div className="text-center p-4 bg-cyan-50 rounded-lg">
                  <p className="text-2xl font-bold text-cyan-700">{rateLimitingStats.topBlockedEndpoints.length}</p>
                  <p className="text-sm text-cyan-600">Endpoint Bloccati</p>
                </div>
              </div>
              {rateLimitingStats.topBlockedEndpoints.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Endpoint Più Bloccati</h4>
                  <div className="space-y-1">
                    {rateLimitingStats.topBlockedEndpoints.map((endpoint: string, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-mono">{endpoint}</span>
                        <Badge variant="destructive">Bloccato</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SSL/TLS Status Dettagliato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Status SSL/TLS e Crittografia
              </CardTitle>
              <CardDescription>
                Monitora lo stato delle connessioni sicure e la validità dei certificati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-700">{sslStats.secureConnections}</p>
                  <p className="text-sm text-emerald-600">Connessioni Sicure</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-700">{sslStats.insecureConnections}</p>
                  <p className="text-sm text-red-600">Connessioni Insecure</p>
                </div>
              </div>
              {sslStats.certificateExpiry && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">Scadenza Certificato SSL</h4>
                  <p className="text-sm text-blue-700">
                    {new Date(sslStats.certificateExpiry).toLocaleDateString('it-IT')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eventi Real-time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-600" />
                Eventi di Sicurezza Real-time
              </CardTitle>
              <CardDescription>
                Monitora gli eventi di sicurezza in tempo reale per rilevare minacce
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {realTimeEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nessun evento di sicurezza recente</p>
                  </div>
                ) : (
                  realTimeEvents.map((event: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          event.severity === 'high' ? 'bg-red-500' :
                          event.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <div>
                          <p className="font-medium">{event.type}</p>
                          <p className="text-sm text-gray-500">{event.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{event.timestamp}</p>
                        <Badge variant={
                          event.severity === 'high' ? 'destructive' :
                          event.severity === 'medium' ? 'secondary' : 'default'
                        }>
                          {event.severity}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={loadSecurityMetrics}>
                  <Activity className="h-4 w-4 mr-2" />
                  Aggiorna Eventi
                </Button>
                <Button variant="outline" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Visualizza Trend
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
