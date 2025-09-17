// File: client/src/pages/RateLimitingDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Clock, 
  Trash2, 
  RefreshCw,
  Eye,
  BarChart3,
  Globe
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

interface RateLimitStats {
  limit_type: string;
  violation_count: number;
  unique_ips: number;
  unique_users: number;
  violation_date: string;
}

interface SuspiciousIP {
  ip_address: string;
  violation_count: number;
  limit_types_violated: number;
  last_violation: string;
  violated_limits: string;
}

interface EndpointStats {
  endpoint: string;
  total_requests: number;
  violations: number;
  violation_percentage: number;
}

interface DashboardData {
  stats: RateLimitStats[];
  suspiciousIPs: SuspiciousIP[];
  endpointStats: EndpointStats[];
  summary: {
    totalViolations: number;
    uniqueIPs: number;
    uniqueUsers: number;
    suspiciousIPCount: number;
  };
}

const RateLimitingDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);

  // Carica dati dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/admin/rate-limiting/dashboard', 'GET');
      
      if (response.success) {
        setDashboardData(response.data);
        setError(null);
      } else {
        setError('Errore nel caricamento dei dati');
      }
    } catch (err) {
      console.error('Errore nel caricamento dashboard rate limiting:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Pulizia violazioni vecchie
  const handleCleanup = async () => {
    try {
      setCleanupLoading(true);
      const response = await apiRequest('/admin/rate-limiting/cleanup', 'POST', {
        retentionDays: cleanupDays
      });
      
      if (response.success) {
        alert(`Pulizia completata: rimosse ${response.data.deletedCount} violazioni`);
        loadDashboardData(); // Ricarica i dati
      } else {
        alert('Errore nella pulizia');
      }
    } catch (err) {
      console.error('Errore nella pulizia:', err);
      alert('Errore di connessione');
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Caricamento dashboard rate limiting...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Dashboard Rate Limiting
        </h1>
        <p className="text-gray-600">
          Monitora e gestisci le violazioni di rate limiting per la sicurezza dell'API.
        </p>
      </div>

      {/* Statistiche Generali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violazioni Totali</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboardData?.summary.totalViolations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Ultimi 7 giorni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IP Unici</CardTitle>
            <Globe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dashboardData?.summary.uniqueIPs || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Con violazioni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utenti Unici</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dashboardData?.summary.uniqueUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Con violazioni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IP Sospetti</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dashboardData?.summary.suspiciousIPCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Da monitorare
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Azioni di Gestione */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Gestione Dati
          </CardTitle>
          <CardDescription>
            Pulisci le violazioni vecchie per mantenere le performance del database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="cleanup-days" className="text-sm font-medium">
                Giorni di ritenzione:
              </label>
              <input
                id="cleanup-days"
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(parseInt(e.target.value))}
                className="w-20 px-2 py-1 border rounded"
                min="1"
                max="365"
              />
            </div>
            <Button 
              onClick={handleCleanup} 
              disabled={cleanupLoading}
              variant="destructive"
            >
              {cleanupLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Pulisci Violazioni
            </Button>
            <Button onClick={loadDashboardData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* IP Sospetti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              IP Sospetti
            </CardTitle>
            <CardDescription>
              Indirizzi IP con più di 3 violazioni negli ultimi 7 giorni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData?.suspiciousIPs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nessun IP sospetto rilevato</p>
              ) : (
                dashboardData?.suspiciousIPs.map((ip, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-mono text-sm font-medium">{ip.ip_address}</div>
                      <div className="text-xs text-gray-500">
                        {ip.violation_count} violazioni • {ip.limit_types_violated} tipi
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">
                        {ip.violation_count}
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(ip.last_violation).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistiche per Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistiche Endpoint
            </CardTitle>
            <CardDescription>
              Violazioni per endpoint negli ultimi 7 giorni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData?.endpointStats.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nessuna statistica disponibile</p>
              ) : (
                dashboardData?.endpointStats.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-mono text-sm font-medium">{endpoint.endpoint}</div>
                      <div className="text-xs text-gray-500">
                        {endpoint.total_requests} richieste totali
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={endpoint.violation_percentage > 10 ? "destructive" : "secondary"}>
                        {endpoint.violations} violazioni
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">
                        {endpoint.violation_percentage}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistiche Dettagliate */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Violazioni per Tipo
          </CardTitle>
          <CardDescription>
            Dettaglio delle violazioni per tipo di limite negli ultimi 7 giorni.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboardData?.stats.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nessuna violazione registrata</p>
            ) : (
              dashboardData?.stats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="font-mono">
                      {stat.limit_type}
                    </Badge>
                    <div>
                      <div className="font-medium">{stat.violation_count} violazioni</div>
                      <div className="text-sm text-gray-500">
                        {stat.unique_ips} IP • {stat.unique_users} utenti
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {new Date(stat.violation_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RateLimitingDashboard;
