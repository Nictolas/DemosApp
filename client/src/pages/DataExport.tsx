import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings
} from 'lucide-react';

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
}

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

  // Carica dati iniziali
  useEffect(() => {
    loadExportHistory();
    loadTableInfo();
  }, []);

  const loadExportHistory = async () => {
    try {
      const response = await fetch('/api/admin/data-export/history');
      if (response.ok) {
        const data = await response.json();
        setExportHistory(data);
      }
    } catch (error) {
      console.error('Errore caricamento cronologia:', error);
    }
  };

  const loadTableInfo = async () => {
    try {
      const response = await fetch('/api/admin/data-export/tables');
      if (response.ok) {
        const data = await response.json();
        setTables(data);
        // Seleziona tutte le tabelle abilitate di default
        setSelectedTables(data.filter((t: TableInfo) => t.enabled).map((t: TableInfo) => t.name));
      }
    } catch (error) {
      console.error('Errore caricamento tabelle:', error);
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
      const response = await fetch('/api/admin/data-export/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tables: selectedTables,
          deleteAfterExport,
          dryRun
        }),
      });

      if (!response.ok) {
        throw new Error('Errore avvio export');
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
        const response = await fetch('/api/admin/data-export/status');
        if (response.ok) {
          const status = await response.json();
          setExportStatus(status);

          if (status.isRunning) {
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
      await fetch('/api/admin/data-export/stop', { method: 'POST' });
      setExportStatus(prev => ({ ...prev, isRunning: false }));
    } catch (error) {
      console.error('Errore stop export:', error);
    }
  };

  const downloadExport = async (exportId: string) => {
    try {
      const response = await fetch(`/api/admin/data-export/download/${exportId}`);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
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

      <Tabs defaultValue="export" className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="history">Cronologia</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          {/* Status Export */}
          {exportStatus.isRunning && (
            <Card>
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
          <Card>
            <CardHeader>
              <CardTitle>Seleziona Tabelle da Esportare</CardTitle>
              <CardDescription>
                Scegli quali tabelle esportare. I dati più vecchi di 30 giorni verranno esportati.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tables.map((table) => (
                  <div key={table.name} className="flex items-center justify-between p-4 border rounded-lg">
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
                          {table.recordCount.toLocaleString()} record • {table.sizeMB.toFixed(1)} MB
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
            </CardContent>
          </Card>

          {/* Opzioni Export */}
          <Card>
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

        <TabsContent value="history" className="space-y-6">
          <Card>
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
                    <div key={exportItem.id} className="flex items-center justify-between p-4 border rounded-lg">
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
          <Card>
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
  );
}
