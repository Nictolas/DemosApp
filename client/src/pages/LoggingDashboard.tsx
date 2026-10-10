// File: client/src/pages/LoggingDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Download, 
  Search, 
  Trash2, 
  RefreshCw, 
  Filter,
  BarChart3,
  FileText,
  Zap,
  Shield,
  Database,
  Eye
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  user_id?: string;
  ip_address?: string;
  endpoint?: string;
  meta_data?: any;
}

interface LogStats {
  period: string;
  totalLogs: number;
  levelCounts: Record<string, number>;
  dailyStats: Record<string, Record<string, number>>;
}

const LoggingDashboard: React.FC = () => {
  const [stats, setStats] = useState<LogStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [searchResults, setSearchResults] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtri di ricerca
  const [searchFilters, setSearchFilters] = useState({
    level: '',
    message: '',
    userId: '',
    ipAddress: '',
    endpoint: '',
    startDate: '',
    endDate: '',
    hours: '24'
  });

  // Carica statistiche
  const loadStats = async (days = 7) => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", `/admin/logging/stats?days=${days}`);
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      setError('Errore caricamento statistiche');
    } finally {
      setLoading(false);
    }
  };

  // Carica log recenti
  const loadRecentLogs = async (hours = 24, limit = 50) => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", `/admin/logging/recent?hours=${hours}&limit=${limit}`);
      if (response.success) {
        setRecentLogs(response.data);
      }
    } catch (err) {
      setError('Errore caricamento log recenti');
    } finally {
      setLoading(false);
    }
  };

  // Ricerca log
  const searchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await apiRequest("GET", `/admin/logging/search?${params.toString()}`);
      if (response.success) {
        setSearchResults(response.data);
      }
    } catch (err) {
      setError('Errore ricerca log');
    } finally {
      setLoading(false);
    }
  };

  // Esporta log
  const exportLogs = async (format = 'json') => {
    try {
      const params = new URLSearchParams();
      if (searchFilters.startDate) params.append('startDate', searchFilters.startDate);
      if (searchFilters.endDate) params.append('endDate', searchFilters.endDate);
      if (searchFilters.level) params.append('level', searchFilters.level);
      params.append('format', format);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/admin/logging/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError('Errore esportazione log');
    }
  };

  // Pulizia log vecchi
  const cleanupLogs = async (retentionDays = 30) => {
    try {
      setLoading(true);
      const response = await apiRequest('POST', '/admin/logging/cleanup', { retentionDays });
      if (response.success) {
        alert(`Puliti ${response.deletedCount} log vecchi`);
        loadStats();
      }
    } catch (err) {
      setError('Errore pulizia log');
    } finally {
      setLoading(false);
    }
  };

  // Carica dati iniziali
  useEffect(() => {
    loadStats();
    loadRecentLogs();
  }, []);

  const getLevelColor = (level: string) => {
    const colors = {
      ERROR: 'bg-red-100 text-red-800',
      WARN: 'bg-yellow-100 text-yellow-800',
      INFO: 'bg-blue-100 text-blue-800',
      DEBUG: 'bg-purple-100 text-purple-800',
      TRACE: 'bg-gray-100 text-gray-800'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getLevelIcon = (level: string) => {
    const icons = {
      ERROR: AlertTriangle,
      WARN: AlertTriangle,
      INFO: Activity,
      DEBUG: Eye,
      TRACE: Eye
    };
    return icons[level as keyof typeof icons] || Activity;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <Database className="h-8 w-8" />
          Sistema di Logging Centralizzato
        </h1>
        <p className="text-gray-600">
          Monitora e gestisci tutti i log dell'applicazione in un sistema unificato.
        </p>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="recent">Log Recenti</TabsTrigger>
          <TabsTrigger value="search">Ricerca</TabsTrigger>
          <TabsTrigger value="management">Gestione</TabsTrigger>
        </TabsList>

        {/* PANORAMICA */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Totale Log</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalLogs.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ultimi {stats?.period || '7 giorni'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errori</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats?.levelCounts.ERROR || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Richiedono attenzione
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Warning</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats?.levelCounts.WARN || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Da monitorare
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Info</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats?.levelCounts.INFO || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Operazioni normali
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Distribuzione per livello */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuzione Log per Livello</CardTitle>
              <CardDescription>
                Visualizzazione dei log per tipo e periodo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.levelCounts && Object.entries(stats.levelCounts).map(([level, count]) => {
                  const percentage = stats.totalLogs > 0 ? (count / stats.totalLogs) * 100 : 0;
                  const IconComponent = getLevelIcon(level);
                  
                  return (
                    <div key={level} className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 w-20">
                        <IconComponent className="h-4 w-4" />
                        <span className="text-sm font-medium">{level}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{count.toLocaleString()}</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOG RECENTI */}
        <TabsContent value="recent" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Log Recenti</h3>
            <div className="flex space-x-2">
              <Select value={searchFilters.hours} onValueChange={(value) => setSearchFilters({...searchFilters, hours: value})}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Ultima ora</SelectItem>
                  <SelectItem value="24">Ultime 24h</SelectItem>
                  <SelectItem value="168">Ultima settimana</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => loadRecentLogs(parseInt(searchFilters.hours))} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {recentLogs.map((log) => {
              const IconComponent = getLevelIcon(log.level);
              
              return (
                <Card key={log.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <IconComponent className="h-5 w-5 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getLevelColor(log.level)}>
                              {log.level}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">{log.message}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            {log.user_id && <span>User: {log.user_id}</span>}
                            {log.ip_address && <span>IP: {log.ip_address}</span>}
                            {log.endpoint && <span>Endpoint: {log.endpoint}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* RICERCA */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Ricerca Avanzata Log
              </CardTitle>
              <CardDescription>
                Filtra i log per livello, messaggio, utente, IP e periodo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="level">Livello</Label>
                  <Select value={searchFilters.level} onValueChange={(value) => setSearchFilters({...searchFilters, level: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tutti i livelli" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tutti i livelli</SelectItem>
                      <SelectItem value="ERROR">ERROR</SelectItem>
                      <SelectItem value="WARN">WARN</SelectItem>
                      <SelectItem value="INFO">INFO</SelectItem>
                      <SelectItem value="DEBUG">DEBUG</SelectItem>
                      <SelectItem value="TRACE">TRACE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="message">Messaggio</Label>
                  <Input
                    id="message"
                    placeholder="Cerca nel messaggio..."
                    value={searchFilters.message}
                    onChange={(e) => setSearchFilters({...searchFilters, message: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="ID utente..."
                    value={searchFilters.userId}
                    onChange={(e) => setSearchFilters({...searchFilters, userId: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    placeholder="Indirizzo IP..."
                    value={searchFilters.ipAddress}
                    onChange={(e) => setSearchFilters({...searchFilters, ipAddress: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="endpoint">Endpoint</Label>
                  <Input
                    id="endpoint"
                    placeholder="Endpoint..."
                    value={searchFilters.endpoint}
                    onChange={(e) => setSearchFilters({...searchFilters, endpoint: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="startDate">Data Inizio</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={searchFilters.startDate}
                    onChange={(e) => setSearchFilters({...searchFilters, startDate: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">Data Fine</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={searchFilters.endDate}
                    onChange={(e) => setSearchFilters({...searchFilters, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={searchLogs} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Cerca
                </Button>
                <Button variant="outline" onClick={() => setSearchFilters({
                  level: '', message: '', userId: '', ipAddress: '', endpoint: '', startDate: '', endDate: '', hours: '24'
                })}>
                  <Filter className="h-4 w-4 mr-2" />
                  Reset Filtri
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Risultati ricerca */}
          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Risultati Ricerca ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {searchResults.map((log) => {
                    const IconComponent = getLevelIcon(log.level);
                    
                    return (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <IconComponent className="h-5 w-5 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge className={getLevelColor(log.level)}>
                                  {log.level}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {new Date(log.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm font-medium mb-1">{log.message}</p>
                              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                {log.user_id && <span>User: {log.user_id}</span>}
                                {log.ip_address && <span>IP: {log.ip_address}</span>}
                                {log.endpoint && <span>Endpoint: {log.endpoint}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GESTIONE */}
        <TabsContent value="management" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Esporta Log
                </CardTitle>
                <CardDescription>
                  Esporta i log in formato JSON o CSV
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="datetime-local"
                    placeholder="Data inizio"
                    value={searchFilters.startDate}
                    onChange={(e) => setSearchFilters({...searchFilters, startDate: e.target.value})}
                  />
                  <Input
                    type="datetime-local"
                    placeholder="Data fine"
                    value={searchFilters.endDate}
                    onChange={(e) => setSearchFilters({...searchFilters, endDate: e.target.value})}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={() => exportLogs('json')} disabled={!searchFilters.startDate || !searchFilters.endDate}>
                    <Download className="h-4 w-4 mr-2" />
                    Esporta JSON
                  </Button>
                  <Button onClick={() => exportLogs('csv')} disabled={!searchFilters.startDate || !searchFilters.endDate}>
                    <Download className="h-4 w-4 mr-2" />
                    Esporta CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Pulizia Log
                </CardTitle>
                <CardDescription>
                  Rimuovi i log vecchi per liberare spazio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="retentionDays">Giorni di ritenzione</Label>
                  <Input
                    id="retentionDays"
                    type="number"
                    placeholder="30"
                    defaultValue="30"
                    min="1"
                    max="365"
                  />
                </div>
                <Button 
                  onClick={() => {
                    const input = document.getElementById('retentionDays') as HTMLInputElement;
                    const days = parseInt(input?.value || '30');
                    if (confirm(`Sei sicuro di voler eliminare tutti i log più vecchi di ${days} giorni?`)) {
                      cleanupLogs(days);
                    }
                  }}
                  variant="destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Pulisci Log Vecchi
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LoggingDashboard;
