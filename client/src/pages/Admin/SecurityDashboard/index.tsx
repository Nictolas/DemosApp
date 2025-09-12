import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BarChart3,
  Clock,
  Users,
  Database,
  TrendingUp
} from 'lucide-react';
import { useLocation } from 'wouter';

export default function SecurityDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');

  // Dati mock per la demo - in produzione verranno da API
  const securityStats = {
    totalViolations: 12,
    criticalIssues: 3,
    rateLimitViolations: 45,
    validationFailures: 8,
    auditLogs: 1250,
    systemHealth: 98.5
  };

  const recentViolations = [
    { id: 1, type: 'Rate Limiting', severity: 'Medium', timestamp: '2 min fa', user: 'user@example.com' },
    { id: 2, type: 'Input Validation', severity: 'High', timestamp: '15 min fa', user: 'admin@example.com' },
    { id: 3, type: 'Security Violation', severity: 'Critical', timestamp: '1 ora fa', user: 'unknown' }
  ];

  const auditLogs = [
    { id: 1, action: 'Login', user: 'user@example.com', timestamp: '5 min fa', status: 'Success' },
    { id: 2, action: 'Data Export', user: 'admin@example.com', timestamp: '12 min fa', status: 'Success' },
    { id: 3, action: 'Account Deletion', user: 'user2@example.com', timestamp: '1 ora fa', status: 'Success' }
  ];

  const performanceMetrics = [
    { name: 'Response Time', value: '245ms', status: 'good' },
    { name: 'CPU Usage', value: '45%', status: 'good' },
    { name: 'Memory Usage', value: '67%', status: 'warning' },
    { name: 'Database Connections', value: '23/100', status: 'good' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 page-with-navbar">
      <div className="container mx-auto px-4 py-8">
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
              onClick={() => setLocation('/admin')}
              variant="outline"
              className="ml-4"
            >
              ← Torna all'Admin
            </Button>
          </div>
        </div>

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

        {/* Tabs per le diverse sezioni */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="violations">Violazioni</TabsTrigger>
            <TabsTrigger value="rate-limiting">Rate Limiting</TabsTrigger>
            <TabsTrigger value="validation">Validazione</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Panoramica */}
          <TabsContent value="overview" className="space-y-6">
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
                    {recentViolations.map((violation) => (
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
                    ))}
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
                    {performanceMetrics.map((metric) => (
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
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audit Logs */}
          <TabsContent value="audit" className="space-y-6">
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
                  {auditLogs.map((log) => (
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
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    Filtra Logs
                  </Button>
                  <Button variant="outline" size="sm">
                    <Database className="h-4 w-4 mr-2" />
                    Esporta Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Violazioni */}
          <TabsContent value="violations" className="space-y-6">
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
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>3 violazioni critiche</strong> richiedono attenzione immediata.
                  </AlertDescription>
                </Alert>
                <div className="space-y-3">
                  {recentViolations.map((violation) => (
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rate Limiting */}
          <TabsContent value="rate-limiting" className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-700">45</p>
                    <p className="text-sm text-yellow-600">Violazioni Oggi</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">12</p>
                    <p className="text-sm text-blue-600">IP Bloccati</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">98%</p>
                    <p className="text-sm text-green-600">Success Rate</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">192.168.1.100</p>
                      <p className="text-sm text-gray-500">45 richieste/min • 2 min fa</p>
                    </div>
                    <Badge variant="destructive">Bloccato</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">10.0.0.5</p>
                      <p className="text-sm text-gray-500">38 richieste/min • 5 min fa</p>
                    </div>
                    <Badge variant="secondary">Warning</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Validazione Input */}
          <TabsContent value="validation" className="space-y-6">
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
                        <Badge variant="destructive">5</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">SQL Injection</span>
                        <Badge variant="destructive">2</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">XSS Attack</span>
                        <Badge variant="destructive">1</Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Azioni Recenti</h4>
                    <div className="space-y-2">
                      <div className="text-sm p-2 bg-red-50 rounded">
                        <strong>Bloccato:</strong> Tentativo SQL injection da 192.168.1.50
                      </div>
                      <div className="text-sm p-2 bg-yellow-50 rounded">
                        <strong>Warning:</strong> Email malformata da user@invalid
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Monitoraggio Performance
                </CardTitle>
                <CardDescription>
                  Monitora performance, salute del sistema e rileva problemi proattivamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {performanceMetrics.map((metric) => (
                    <div key={metric.name} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{metric.name}</span>
                        <Badge 
                          variant={metric.status === 'good' ? 'default' : 
                                  metric.status === 'warning' ? 'secondary' : 'destructive'}
                        >
                          {metric.status}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Logging Centralizzato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">1,250</p>
                      <p className="text-sm text-blue-600">Log Oggi</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-700">98%</p>
                      <p className="text-sm text-green-600">Success Rate</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-700">12</p>
                      <p className="text-sm text-yellow-600">Errori</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
