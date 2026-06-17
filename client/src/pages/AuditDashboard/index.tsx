import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart3, 
  Shield, 
  Users, 
  Activity, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AuditStats {
  total_actions: number;
  successful_actions: number;
  failed_actions: number;
  unique_users: number;
  unique_actions: number;
  unique_resources: number;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id: string;
  details: any;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  success: boolean;
  error_message: string;
}

interface TopItem {
  action?: string;
  resource?: string;
  user_id?: string;
  count: number;
}

interface DailyActivity {
  date: string;
  actions: number;
  successful: number;
  failed: number;
}

export default function AuditDashboard() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [topActions, setTopActions] = useState<TopItem[]>([]);
  const [topResources, setTopResources] = useState<TopItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopItem[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtri
  const [filters, setFilters] = useState({
    days: '30',
    page: 1,
    limit: 50,
    search: '',
    action: '',
    resource: '',
    success: 'all',
    user_id: ''
  });

  // Carica dati iniziali
  useEffect(() => {
    loadDashboardData();
  }, [filters.days]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carica statistiche
      const statsResponse = await apiRequest.get(`/admin/audit-dashboard/stats?days=${filters.days}`);
      if (statsResponse.success) {
        setStats(statsResponse.data.general_stats);
        setTopActions(statsResponse.data.top_actions);
        setTopResources(statsResponse.data.top_resources);
        setTopUsers(statsResponse.data.top_users);
        setDailyActivity(statsResponse.data.daily_activity);
      }

      // Carica log
      const logsResponse = await apiRequest.get('/admin/audit-dashboard/logs', {
        params: {
          page: filters.page,
          limit: filters.limit,
          search: filters.search || undefined,
          action: filters.action || undefined,
          resource: filters.resource || undefined,
          success: filters.success === 'all' ? undefined : filters.success || undefined,
          user_id: filters.user_id || undefined
        }
      });
      
      if (logsResponse.success) {
        setLogs(logsResponse.data.logs);
      }

    } catch (err) {
      console.error('Errore nel caricamento dashboard audit:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSearch = () => {
    loadDashboardData();
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login': return <Shield className="h-4 w-4" />;
      case 'logout': return <XCircle className="h-4 w-4" />;
      case 'create': return <CheckCircle className="h-4 w-4" />;
      case 'update': return <RefreshCw className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      case 'view': return <Eye className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getSuccessBadge = (success: boolean) => {
    return success ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Successo
      </Badge>
    ) : (
      <Badge variant="destructive" className="bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Errore
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Caricamento dashboard audit...</p>
        </div>
      </div>
    );
  }

  if (!user?.ruolo || user.ruolo !== "AD") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Accesso Negato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Non hai i permessi per accedere alla dashboard di audit.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Dashboard Audit
          </h1>
          <p className="text-gray-600 text-lg">
            Monitoraggio delle attività e sicurezza del sistema
          </p>
        </div>

        {/* Istruzioni */}
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Activity className="h-5 w-5" />
              Come utilizzare la Dashboard Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Statistiche Generali
                </h3>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• <strong>Totale Azioni:</strong> Numero totale di azioni registrate</li>
                  <li>• <strong>Azioni Riuscite:</strong> Percentuale di successo delle operazioni</li>
                  <li>• <strong>Azioni Fallite:</strong> Errori e problemi rilevati</li>
                  <li>• <strong>Utenti Attivi:</strong> Numero di utenti unici che hanno effettuato azioni</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtri e Ricerca
                </h3>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• <strong>Periodo:</strong> Seleziona l'intervallo di tempo (7/30/90 giorni)</li>
                  <li>• <strong>Azione:</strong> Filtra per tipo di azione specifica</li>
                  <li>• <strong>Risorsa:</strong> Filtra per risorsa coinvolta</li>
                  <li>• <strong>Stato:</strong> Mostra solo successi, errori o tutti</li>
                  <li>• <strong>Ricerca:</strong> Cerca testo nei log di audit</li>
                </ul>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white/50 rounded-lg p-3">
                <h4 className="font-semibold text-blue-700 mb-1">Top Azioni</h4>
                <p className="text-xs text-blue-600">Le azioni più frequenti nel sistema</p>
              </div>
              <div className="bg-white/50 rounded-lg p-3">
                <h4 className="font-semibold text-blue-700 mb-1">Top Risorse</h4>
                <p className="text-xs text-blue-600">Le risorse più accessate dagli utenti</p>
              </div>
              <div className="bg-white/50 rounded-lg p-3">
                <h4 className="font-semibold text-blue-700 mb-1">Top Utenti</h4>
                <p className="text-xs text-blue-600">Gli utenti più attivi nel sistema</p>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800 text-sm">Nota Importante</h4>
                  <p className="text-xs text-yellow-700 mt-1">
                    Questa dashboard è riservata agli amministratori. I dati mostrati sono sensibili e 
                    devono essere utilizzati solo per scopi di monitoraggio e sicurezza del sistema.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistiche Generali */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="transform hover:scale-105 transition-all duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Totale Azioni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">{stats.total_actions.toLocaleString()}</div>
                <p className="text-xs text-gray-500">Ultimi {filters.days} giorni</p>
              </CardContent>
            </Card>

            <Card className="transform hover:scale-105 transition-all duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Azioni Riuscite</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.successful_actions.toLocaleString()}</div>
                <p className="text-xs text-gray-500">
                  {stats.total_actions > 0 ? Math.round((stats.successful_actions / stats.total_actions) * 100) : 0}% successo
                </p>
              </CardContent>
            </Card>

            <Card className="transform hover:scale-105 transition-all duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Azioni Fallite</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failed_actions.toLocaleString()}</div>
                <p className="text-xs text-gray-500">
                  {stats.total_actions > 0 ? Math.round((stats.failed_actions / stats.total_actions) * 100) : 0}% errori
                </p>
              </CardContent>
            </Card>

            <Card className="transform hover:scale-105 transition-all duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Utenti Attivi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.unique_users.toLocaleString()}</div>
                <p className="text-xs text-gray-500">Utenti unici</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtri */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri e Ricerca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Periodo</label>
                <Select value={filters.days} onValueChange={(value) => handleFilterChange('days', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Ultimi 7 giorni</SelectItem>
                    <SelectItem value="30">Ultimi 30 giorni</SelectItem>
                    <SelectItem value="90">Ultimi 90 giorni</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Azione</label>
                <Input
                  placeholder="Filtra per azione..."
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Risorsa</label>
                <Input
                  placeholder="Filtra per risorsa..."
                  value={filters.resource}
                  onChange={(e) => handleFilterChange('resource', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Stato</label>
                <Select value={filters.success} onValueChange={(value) => handleFilterChange('success', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="true">Solo successi</SelectItem>
                    <SelectItem value="false">Solo errori</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Input
                placeholder="Cerca nei log..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearch} className="px-6">
                <Search className="h-4 w-4 mr-2" />
                Cerca
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Top Azioni */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Azioni
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topActions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {getActionIcon(item.action || '')}
                      <span className="font-medium">{item.action}</span>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Risorse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Top Risorse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topResources.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-medium">{item.resource}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Utenti */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Utenti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topUsers.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-medium">{item.user_id}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Log delle Attività
            </CardTitle>
            <CardDescription>
              Ultimi {logs.length} log di audit
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-gray-600">Caricamento log...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Timestamp</th>
                      <th className="text-left p-2">Utente</th>
                      <th className="text-left p-2">Azione</th>
                      <th className="text-left p-2">Risorsa</th>
                      <th className="text-left p-2">Stato</th>
                      <th className="text-left p-2">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-sm text-gray-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2 font-medium">{log.user_id}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            {log.action}
                          </div>
                        </td>
                        <td className="p-2">{log.resource}</td>
                        <td className="p-2">{getSuccessBadge(log.success)}</td>
                        <td className="p-2 text-sm text-gray-600">{log.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
