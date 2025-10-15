import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import apiRequest from '@/lib/api-request';
import { 
  Download, 
  HardDrive, 
  Database, 
  FileText, 
  Trash2, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertCircle,
  Clock,
  BarChart3,
  Settings,
  PieChart as PieChartIcon,
  List
} from 'lucide-react';
import { Link } from 'wouter';

interface ExportStatus {
  isRunning: boolean;
  progress: number;
  currentTable: string;
  totalTables: number;
  exportedRecords: number;
  totalRecords: number;
  error?: string;
}

interface ExportHistory {
  id: string;
  date: string;
  totalRecords: number;
  totalFiles: number;
  tables: number;
  status: 'completed' | 'failed' | 'running';
}

interface TableInfo {
  name: string;
  enabled: boolean;
  retentionDays: number;
  recordCount: number;
  sizeMB: number;
  sizeKB: number;
  sizeBytes: number;
}

interface DatabaseAnalysis {
  totalDatabaseSizeMB: number;
  totalDatabaseSizePretty: string;
  categories: {
    exportable: {
      name: string;
      tables: Array<{
        name: string;
        sizeMB: number;
        sizePretty: string;
        columnCount: number;
      }>;
      totalSizeMB: number;
      percentage: number;
      color: string;
    };
    users: {
      name: string;
      tables: Array<{
        name: string;
        sizeMB: number;
        sizePretty: string;
        columnCount: number;
      }>;
      totalSizeMB: number;
      percentage: number;
      color: string;
    };
    content: {
      name: string;
      tables: Array<{
        name: string;
        sizeMB: number;
        sizePretty: string;
        columnCount: number;
      }>;
      totalSizeMB: number;
      percentage: number;
      color: string;
    };
    system: {
      name: string;
      tables: Array<{
        name: string;
        sizeMB: number;
        sizePretty: string;
        columnCount: number;
      }>;
      totalSizeMB: number;
      percentage: number;
      color: string;
    };
    other: {
      name: string;
      tables: Array<{
        name: string;
        sizeMB: number;
        sizePretty: string;
        columnCount: number;
      }>;
      totalSizeMB: number;
      percentage: number;
      color: string;
    };
  };
}

// Funzione helper per formattare le dimensioni
const formatSize = (sizeMB: number, sizeKB: number): string => {
  if (sizeMB >= 1) {
    return `${sizeMB.toFixed(1)} MB`;
  } else if (sizeKB >= 1) {
    return `${sizeKB} KB`;
  } else {
    return '0 KB';
  }
};

export default function DataExport() {
  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    isRunning: false,
    progress: 0,
    currentTable: '',
    totalTables: 0,
    exportedRecords: 0,
    totalRecords: 0
  });

  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [deleteAfterExport, setDeleteAfterExport] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [loadingTables, setLoadingTables] = useState(true);
  const [databaseAnalysis, setDatabaseAnalysis] = useState<DatabaseAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);

  // Carica dati iniziali
  useEffect(() => {
    loadExportHistory();
    loadTableInfo();
    loadDatabaseAnalysis();
  }, []);

  const loadExportHistory = async () => {
    try {
      const response = await apiRequest.get('/admin/data-export/history');
      if (response.success) {
        setExportHistory(response.data);
      }
    } catch (error) {
      console.error('Errore caricamento cronologia:', error);
    }
  };

  const loadTableInfo = async () => {
    setLoadingTables(true);
    try {
      const response = await apiRequest.get('/admin/data-export/tables');
      if (response.success) {
        setTables(response.data);
        // Seleziona tutte le tabelle abilitate di default
        setSelectedTables(response.data.filter((t: TableInfo) => t.enabled).map((t: TableInfo) => t.name));
      } else {
        // Fallback: usa dati mock se l'API non è disponibile
        const mockTables: TableInfo[] = [
          {
            name: 'centralized_logs',
            enabled: true,
            retentionDays: 14,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          },
          {
            name: 'security_events',
            enabled: true,
            retentionDays: 30,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          },
          {
            name: 'performance_metrics',
            enabled: true,
            retentionDays: 7,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          },
          {
            name: 'health_checks',
            enabled: true,
            retentionDays: 7,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          },
          {
            name: 'access_audit',
            enabled: true,
            retentionDays: 30,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          },
          {
            name: 'audit_logs',
            enabled: true,
            retentionDays: 30,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          }
        ];
        setTables(mockTables);
        setSelectedTables(mockTables.map(t => t.name));
      }
    } catch (error) {
      console.error('Errore caricamento tabelle:', error);
      // Usa dati mock in caso di errore
      const mockTables: TableInfo[] = [
        {
          name: 'centralized_logs',
          enabled: true,
          retentionDays: 14,
          recordCount: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0
        },
        {
          name: 'security_events',
          enabled: true,
          retentionDays: 30,
          recordCount: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0
        },
        {
          name: 'performance_metrics',
          enabled: true,
          retentionDays: 7,
          recordCount: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0
        },
        {
          name: 'health_checks',
          enabled: true,
          retentionDays: 7,
          recordCount: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0
        },
        {
          name: 'access_audit',
          enabled: true,
          retentionDays: 30,
          recordCount: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0
        },
        {
          name: 'audit_logs',
          enabled: true,
          retentionDays: 30,
          recordCount: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0
        }
      ];
      setTables(mockTables);
      setSelectedTables(mockTables.map(t => t.name));
    } finally {
      setLoadingTables(false);
    }
  };

  const startExport = async () => {
    if (selectedTables.length === 0) {
      alert('Seleziona almeno una tabella da esportare');
      return;
    }

    setExportStatus({
      isRunning: true,
      progress: 0,
      currentTable: '',
      totalTables: selectedTables.length,
      exportedRecords: 0,
      totalRecords: 0
    });

    try {
      const response = await apiRequest.post('/admin/data-export/start', {
        tables: selectedTables,
        deleteAfterExport,
        dryRun
      });

      if (!response.success) {
        throw new Error(response.error || 'Errore avvio export');
      }

      // Polling per aggiornare lo stato
      pollExportStatus();

    } catch (error) {
      setExportStatus(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      }));
    }
  };

  const pollExportStatus = async () => {
    const poll = async () => {
      try {
        const response = await apiRequest.get('/admin/data-export/status');
        if (response.success) {
          setExportStatus(response.data);

          if (response.data.isRunning) {
            setTimeout(poll, 2000); // Poll ogni 2 secondi
          } else {
            // Export completato, ricarica cronologia
            loadExportHistory();
          }
        }
      } catch (error) {
        console.error('Errore polling status:', error);
        setExportStatus(prev => ({
          ...prev,
          isRunning: false,
          error: 'Errore comunicazione server'
        }));
      }
    };

    poll();
  };

  const stopExport = async () => {
    try {
      await apiRequest.post('/admin/data-export/stop');
      setExportStatus(prev => ({ ...prev, isRunning: false }));
    } catch (error) {
      console.error('Errore stop export:', error);
    }
  };

  const downloadExport = async (exportId: string) => {
    try {
      // Per il download, usiamo fetch diretto perché apiRequest non gestisce blob
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://demos-c7k0.onrender.com/api'}/admin/data-export/download/${exportId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${exportId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Errore download:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status === 'completed' && 'Completato'}
        {status === 'failed' && 'Fallito'}
        {status === 'running' && 'In corso'}
      </Badge>
    );
  };

  const loadDatabaseAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const response = await apiRequest.get('/admin/data-export/database-analysis');
      if (response.success) {
        setDatabaseAnalysis(response.data);
      } else {
        console.error('Errore caricamento analisi database:', response.error);
        setDatabaseAnalysis(null);
      }
    } catch (error) {
      console.error('Errore caricamento analisi database:', error);
      setDatabaseAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };


  const getTableDescription = (tableName: string) => {
    const descriptions: { [key: string]: string } = {
      'centralized_logs': 'Log centralizzati di tutte le operazioni del sistema',
      'security_events': 'Eventi di sicurezza e tentativi di accesso',
      'performance_metrics': 'Metriche di performance del sistema (CPU, memoria, DB)',
      'health_checks': 'Controlli di salute del sistema e servizi',
      'access_audit': 'Audit di tutti gli accessi e operazioni utente',
      'audit_logs': 'Log di audit per conformità e sicurezza'
    };
    
    return descriptions[tableName] || 'Tabella di monitoraggio e logging';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Export Dati su Hard Disk</h1>
          <p className="text-gray-600 mt-2">
            Esporta i dati storici dal database Neon su hard disk esterno per alleggerire il database
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <HardDrive className="h-8 w-8 text-blue-500" />
          <Database className="h-8 w-8 text-green-500" />
        </div>
      </div>

      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analysis">Analisi</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="history">Cronologia</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          {/* Status Export */}
          {exportStatus.isRunning && (
            <Card className="bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Play className="h-5 w-5 text-blue-500" />
                  <span>Export in Corso</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span>{exportStatus.progress}%</span>
                  </div>
                  <Progress value={exportStatus.progress} className="w-full" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Tabella corrente:</span>
                    <p className="text-gray-600">{exportStatus.currentTable || 'Inizializzazione...'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Record esportati:</span>
                    <p className="text-gray-600">
                      {exportStatus.exportedRecords.toLocaleString()} / {exportStatus.totalRecords.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button onClick={stopExport} variant="outline" className="w-full">
                  <Pause className="h-4 w-4 mr-2" />
                  Interrompi Export
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Errori */}
          {exportStatus.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{exportStatus.error}</AlertDescription>
            </Alert>
          )}

          {/* Selezione Tabelle */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Seleziona Tabelle da Esportare</CardTitle>
                  <CardDescription>
                    Scegli quali tabelle esportare. I dati più vecchi di 30 giorni verranno esportati.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Link href="/admin/data-export/centralized-logs">
                    <Button variant="outline" size="sm">
                      <List className="h-4 w-4 mr-2" />
                      Visualizza Log
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTableInfo}
                    disabled={loadingTables}
                  >
                    {loadingTables ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    ) : (
                      'Aggiorna'
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTables ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">Caricamento tabelle...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {tables.map((table) => (
                  <div key={table.name} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTables([...selectedTables, table.name]);
                          } else {
                            setSelectedTables(selectedTables.filter(t => t !== table.name));
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <div>
                        <h4 className="font-medium">{table.name}</h4>
                        <p className="text-sm text-gray-600">
                          {table.recordCount.toLocaleString()} record • {formatSize(table.sizeMB, table.sizeKB)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getTableDescription(table.name)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={table.enabled ? 'default' : 'secondary'}>
                        {table.enabled ? 'Abilitata' : 'Disabilitata'}
                      </Badge>
                      <Badge variant="outline">
                        {table.retentionDays} giorni
                      </Badge>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opzioni Export */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle>Opzioni Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="deleteAfterExport"
                  checked={deleteAfterExport}
                  onChange={(e) => setDeleteAfterExport(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="deleteAfterExport" className="text-sm">
                  Elimina dati dal database dopo l'export
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="dryRun"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="dryRun" className="text-sm">
                  Modalità test (solo conteggi, nessun file creato)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Pulsante Avvio */}
          <div className="flex justify-center">
            <Button 
              onClick={startExport} 
              disabled={exportStatus.isRunning || selectedTables.length === 0}
              size="lg"
              className="px-8"
            >
              <Download className="h-5 w-5 mr-2" />
              {dryRun ? 'Simula Export' : 'Avvia Export'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          {/* Analisi Database */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Analisi Peso Database
                  </CardTitle>
                  <CardDescription>
                    Distribuzione del peso del database per categorie
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadDatabaseAnalysis}
                  disabled={loadingAnalysis}
                >
                  {loadingAnalysis ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  ) : (
                    'Aggiorna'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAnalysis ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">Caricamento analisi...</span>
                </div>
              ) : databaseAnalysis ? (
                <div className="space-y-6">
                  {/* Dimensione Totale */}
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-2xl font-bold text-blue-800">
                      {databaseAnalysis.totalDatabaseSizePretty}
                    </h3>
                    <p className="text-blue-600">Dimensione totale database</p>
                  </div>

                  {/* Grafico a Torta */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-lg">Distribuzione per Categorie</h4>
                      <div className="h-96 xl:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.values(databaseAnalysis.categories).map(category => ({
                                name: category.name,
                                value: category.totalSizeMB,
                                percentage: category.percentage,
                                color: category.color
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name}: ${percentage}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.values(databaseAnalysis.categories).map((category, index) => (
                                <Cell key={`cell-${index}`} fill={category.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => [`${value} MB`, 'Dimensione']}
                              labelFormatter={(label) => `Categoria: ${label}`}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Dettagli Categorie */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-lg">Dettagli Categorie</h4>
                      <div className="space-y-3">
                        {Object.values(databaseAnalysis.categories).map((category) => (
                          <div key={category.name} className="p-3 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-4 h-4 rounded-full" 
                                  style={{ backgroundColor: category.color }}
                                ></div>
                                <span className="font-medium">{category.name}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">
                                  {category.totalSizeMB === 0 && category.totalSizeKB > 0 ? 
                                    category.totalSizeKB + ' kB' :
                                    category.totalSizeMB > 0 ? 
                                      category.totalSizeMB + ' MB' : 
                                      '0 MB'
                                  }
                                </div>
                                <div className="text-sm text-gray-600">{category.percentage}%</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {category.tables.length} tabelle
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card per tutte le categorie di tabelle */}
                  <div className="space-y-8">
                    {/* Tabelle da Esportare */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-red-500"></span>
                        Tabelle da Esportare ({databaseAnalysis.categories.exportable.tables.length} tabelle)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {databaseAnalysis.categories.exportable.tables.map((table) => {
                          const isCentralizedLogs = table.name === 'centralized_logs';
                          const CardComponent = isCentralizedLogs ? Link : 'div';
                          const cardProps = isCentralizedLogs ? { href: '/admin/data-export/centralized-logs' } : {};
                          
                          return (
                            <CardComponent 
                              key={table.name} 
                              {...cardProps}
                              className={`p-4 border rounded-lg bg-white border-red-200 hover:shadow-md transition-all ${isCentralizedLogs ? 'cursor-pointer hover:border-red-300' : ''}`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-medium text-red-800 flex items-center gap-2 text-sm">
                                    {table.name}
                                    {isCentralizedLogs && <List className="h-3 w-3" />}
                                  </h5>
                                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-xs text-gray-600">{table.columnCount} colonne</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-red-800 text-sm">{table.sizePretty}</div>
                                    <div className="text-xs text-red-600">{table.sizeMB} MB</div>
                                  </div>
                                </div>
                              </div>
                            </CardComponent>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dati Utenti */}
                    {databaseAnalysis.categories.users.tables.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                          Dati Utenti ({databaseAnalysis.categories.users.tables.length} tabelle)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                          {databaseAnalysis.categories.users.tables.map((table) => (
                            <div 
                              key={table.name} 
                              className="p-4 border rounded-lg bg-white border-blue-200 hover:shadow-md transition-all"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-medium text-blue-800 text-sm">{table.name}</h5>
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-xs text-gray-600">{table.columnCount} colonne</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-blue-800 text-sm">{table.sizePretty}</div>
                                    <div className="text-xs text-blue-600">{table.sizeMB} MB</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contenuti App */}
                    {databaseAnalysis.categories.content.tables.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-green-500"></span>
                          Contenuti App ({databaseAnalysis.categories.content.tables.length} tabelle)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                          {databaseAnalysis.categories.content.tables.map((table) => (
                            <div 
                              key={table.name} 
                              className="p-4 border rounded-lg bg-white border-green-200 hover:shadow-md transition-all"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-medium text-green-800 text-sm">{table.name}</h5>
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-xs text-gray-600">{table.columnCount} colonne</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-green-800 text-sm">{table.sizePretty}</div>
                                    <div className="text-xs text-green-600">{table.sizeMB} MB</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sistema */}
                    {databaseAnalysis.categories.system.tables.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
                          Sistema ({databaseAnalysis.categories.system.tables.length} tabelle)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                          {databaseAnalysis.categories.system.tables.map((table) => (
                            <div 
                              key={table.name} 
                              className="p-4 border rounded-lg bg-white border-yellow-200 hover:shadow-md transition-all"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-medium text-yellow-800 text-sm">{table.name}</h5>
                                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-xs text-gray-600">{table.columnCount} colonne</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-yellow-800 text-sm">{table.sizePretty}</div>
                                    <div className="text-xs text-yellow-600">{table.sizeMB} MB</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabelle Temporanee */}
                    {databaseAnalysis.categories.other.tables.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-gray-500"></span>
                          Tabelle Temporanee ({databaseAnalysis.categories.other.tables.length} tabelle)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                          {databaseAnalysis.categories.other.tables.map((table) => (
                            <div 
                              key={table.name} 
                              className="p-4 border rounded-lg bg-white border-gray-200 hover:shadow-md transition-all"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-medium text-gray-800 text-sm">{table.name}</h5>
                                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-xs text-gray-600">{table.columnCount} colonne</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-gray-800 text-sm">{table.sizePretty}</div>
                                    <div className="text-xs text-gray-600">{table.sizeMB} MB</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Potenziale Risparmio */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">
                      💾 Potenziale Risparmio
                    </h4>
                    <p className="text-green-700">
                      Esportando le tabelle di monitoraggio, potresti liberare{' '}
                      <strong>{databaseAnalysis.categories.exportable.totalSizeMB} MB</strong>{' '}
                      ({databaseAnalysis.categories.exportable.percentage}% del database totale)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Impossibile caricare l'analisi del database</p>
                  <p className="text-sm mt-2">Il server è attivo ma il database non è connesso</p>
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      <strong>Nota:</strong> Per vedere i dati reali, assicurati che:
                    </p>
                    <ul className="text-yellow-700 text-sm mt-2 text-left">
                      <li>• Il database Neon sia configurato nel file .env</li>
                      <li>• La connessione al database sia attiva</li>
                      <li>• Le tabelle di monitoraggio esistano nel database</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle>Cronologia Export</CardTitle>
              <CardDescription>
                Storico degli export eseguiti su hard disk esterno
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exportHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun export eseguito</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exportHistory.map((exportItem) => (
                    <div key={exportItem.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(exportItem.status)}
                        <div>
                          <h4 className="font-medium">Export del {exportItem.date}</h4>
                          <p className="text-sm text-gray-600">
                            {exportItem.totalRecords.toLocaleString()} record • {exportItem.totalFiles} file • {exportItem.tables} tabelle
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(exportItem.status)}
                        {exportItem.status === 'completed' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => downloadExport(exportItem.id)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle>Impostazioni Export</CardTitle>
              <CardDescription>
                Configura le impostazioni per l'export automatico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Directory di Destinazione</h4>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <code className="text-sm">/mnt/external-drive/archivio</code>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Compressione</h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default">Abilitata</Badge>
                    <span className="text-sm text-gray-600">GZIP Level 6</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Formato File</h4>
                  <Badge variant="outline">CSV</Badge>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Dimensione Max File</h4>
                  <Badge variant="outline">100 MB</Badge>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Policy di Retention</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Security Events:</span>
                    <span>30 giorni</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Performance Metrics:</span>
                    <span>7 giorni</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Centralized Logs:</span>
                    <span>14 giorni</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Access Audit:</span>
                    <span>30 giorni</span>
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
