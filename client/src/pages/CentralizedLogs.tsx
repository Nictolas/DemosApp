// File: client/src/pages/CentralizedLogs.tsx
// Pagina per visualizzare i log centralizzati con glossario

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, Clock, User, Globe, Code } from 'lucide-react';
import apiRequest from '@/lib/api-request';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  user_id: string | null;
  ip_address: string | null;
  endpoint: string | null;
  request_id: string | null;
  meta_data: any;
}

interface GlossaryEntry {
  code: string;
  full_name: string;
  description: string;
}

interface LogStats {
  total_logs: number;
  unique_levels: number;
  oldest_log: string;
  newest_log: string;
}

interface CentralizedLogsData {
  recentLogs: LogEntry[];
  glossary: GlossaryEntry[];
  stats: LogStats;
}

// Funzione per decodificare il livello
const decodeLevel = (code: string): string => {
  const mapping: { [key: string]: string } = {
    'E': 'ERROR',
    'W': 'WARN',
    'I': 'INFO',
    'D': 'DEBUG',
    'T': 'TRACE'
  };
  return mapping[code] || 'UNKNOWN';
};

// Funzione per ottenere il colore del badge
const getLevelColor = (code: string): string => {
  const colors: { [key: string]: string } = {
    'E': 'bg-red-100 text-red-800 border-red-200',
    'W': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'I': 'bg-blue-100 text-blue-800 border-blue-200',
    'D': 'bg-gray-100 text-gray-800 border-gray-200',
    'T': 'bg-purple-100 text-purple-800 border-purple-200'
  };
  return colors[code] || 'bg-gray-100 text-gray-800 border-gray-200';
};

// Funzione per formattare la data
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Funzione per troncare il messaggio
const truncateMessage = (message: string, maxLength: number = 100): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
};

export default function CentralizedLogs() {
  const [data, setData] = useState<CentralizedLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest.get('/admin/data-export/centralized-logs');
      if (response.success) {
        setData(response.data);
      } else {
        setError('Errore nel caricamento dei dati');
      }
    } catch (err) {
      console.error('Errore caricamento log centralizzati:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Caricamento log centralizzati...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center text-red-800">
              <Database className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
            <Button onClick={fetchData} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Nessun dato disponibile</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Log Centralizzati</h1>
          <p className="text-gray-600 mt-2">
            Visualizzazione dei log più recenti con glossario dei livelli ottimizzati
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      {/* Statistiche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Statistiche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {data.stats.total_logs.toLocaleString()}
              </div>
              <div className="text-sm text-blue-800">Log Totali</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data.stats.unique_levels}
              </div>
              <div className="text-sm text-green-800">Livelli Unici</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-sm font-bold text-yellow-600">
                {formatTimestamp(data.stats.oldest_log)}
              </div>
              <div className="text-sm text-yellow-800">Log Più Vecchio</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm font-bold text-purple-600">
                {formatTimestamp(data.stats.newest_log)}
              </div>
              <div className="text-sm text-purple-800">Log Più Recente</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glossario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Glossario Livelli Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.glossary.map((entry) => (
              <div key={entry.code} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getLevelColor(entry.code)}>
                    {entry.code}
                  </Badge>
                  <span className="font-semibold">{entry.full_name}</span>
                </div>
                <p className="text-sm text-gray-600">{entry.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log Recenti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            10 Log Più Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getLevelColor(log.level)}>
                      {log.level}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    ID: {log.id.substring(0, 8)}...
                  </div>
                </div>
                
                <div className="mb-2">
                  <p className="text-gray-900 font-medium">
                    {truncateMessage(log.message)}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {log.user_id && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>User: {log.user_id.substring(0, 8)}...</span>
                    </div>
                  )}
                  {log.ip_address && (
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>IP: {log.ip_address}</span>
                    </div>
                  )}
                  {log.endpoint && (
                    <div className="flex items-center gap-1">
                      <Code className="h-3 w-3" />
                      <span>Endpoint: {log.endpoint}</span>
                    </div>
                  )}
                </div>
                
                {log.meta_data && Object.keys(log.meta_data).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Metadata ({Object.keys(log.meta_data).length} campi)
                    </summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(log.meta_data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
