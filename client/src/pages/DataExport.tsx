import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import apiRequest from '@/lib/api-request';
import { getApiUrl } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-token';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Download,
  FileText,
  HardDrive,
  Info,
  List,
  Pause,
  Play,
  RefreshCw,
  Search,
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
  sizeKB: number;
  sizeBytes: number;
  exportableRecords?: number;
}

interface DatabaseAnalysis {
  totalDatabaseSizeMB?: number;
  totalDatabaseSizePretty?: string;
  categories?: Record<
    string,
    {
      name?: string;
      totalSizeMB?: number;
      totalSizeKB?: number;
      percentage?: number;
      tables?: Array<{
        name: string;
        sizeMB?: number;
        sizePretty?: string;
        columnCount?: number;
      }>;
    }
  >;
}

interface AxiomDatasetAnalysis {
  name: string;
  label?: string;
  count: number | null;
  dataSizeMB?: number | null;
  error?: string | null;
  needsManualCheck?: boolean;
}

interface AxiomAnalysis {
  totalEvents: number;
  totalDataSizeMB?: number;
  datasets: AxiomDatasetAnalysis[];
  needsManualCheck?: boolean;
  migrationCompleted?: boolean;
}

const EMPTY_STATUS: ExportStatus = {
  isRunning: false,
  progress: 0,
  currentTable: '',
  totalTables: 0,
  exportedRecords: 0,
  totalRecords: 0,
};

const formatSize = (sizeMB = 0, sizeKB = 0): string => {
  if (sizeMB >= 1) return `${sizeMB.toFixed(1)} MB`;
  if (sizeKB >= 1) return `${sizeKB.toFixed(1)} KB`;
  return '0 KB';
};

const tableDescription = (tableName: string) => {
  const descriptions: Record<string, string> = {
    centralized_logs: 'Log centralizzati di tutte le operazioni del sistema',
    security_events: 'Eventi di sicurezza e tentativi di accesso',
    performance_metrics: 'Metriche di performance del sistema',
    health_checks: 'Controlli di salute del sistema e servizi',
    access_audit: 'Audit degli accessi e delle operazioni utente',
    audit_logs: 'Log di audit per conformità e sicurezza',
  };
  return descriptions[tableName] || 'Tabella del database DEMOS';
};

export default function DataExport() {
  const { toast } = useToast();

  const [exportStatus, setExportStatus] = useState<ExportStatus>(EMPTY_STATUS);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [deleteAfterExport, setDeleteAfterExport] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [loadingTables, setLoadingTables] = useState(true);
  const [databaseAnalysis, setDatabaseAnalysis] = useState<DatabaseAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [axiomAnalysis, setAxiomAnalysis] = useState<AxiomAnalysis | null>(null);
  const [loadingAxiom, setLoadingAxiom] = useState(true);
  const [securityEventsStats, setSecurityEventsStats] = useState<any>(null);
  const [loadingSecurityEvents, setLoadingSecurityEvents] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadExportHistory();
    loadTableInfo();
    loadDatabaseAnalysis();
    loadAxiomAnalysis();
    loadSecurityEventsStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => {
      loadDatabaseAnalysis();
      loadAxiomAnalysis();
      loadSecurityEventsStats();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [autoRefresh]);

  const filteredTables = useMemo(
    () => tables.filter((table) => table.name.toLowerCase().includes(tableSearch.toLowerCase())),
    [tables, tableSearch],
  );

  const loadExportHistory = async () => {
    try {
      const response = await apiRequest.get<ExportHistory[]>('/admin/data-export/history');
      setExportHistory(response.success && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Errore caricamento cronologia:', error);
      setExportHistory([]);
    }
  };

  const loadTableInfo = async () => {
    setLoadingTables(true);
    setTablesError(null);
    try {
      const response = await apiRequest.get<TableInfo[]>('/admin/data-export/tables');
      if (!response.success || !Array.isArray(response.data)) {
        setTables([]);
        setSelectedTables([]);
        setTablesError(response.error || 'Impossibile caricare le tabelle reali dal server.');
        return;
      }

      setTables(response.data);
      setSelectedTables(response.data.filter((table) => table.enabled).map((table) => table.name));
    } catch (error) {
      console.error('Errore caricamento tabelle:', error);
      setTables([]);
      setSelectedTables([]);
      setTablesError('Impossibile caricare le tabelle reali dal server.');
    } finally {
      setLoadingTables(false);
    }
  };

  const loadDatabaseAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const response = await apiRequest.get<DatabaseAnalysis>('/admin/data-export/database-analysis');
      setDatabaseAnalysis(response.success && response.data ? response.data : null);
    } catch (error) {
      console.error('Errore caricamento analisi database:', error);
      setDatabaseAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const loadAxiomAnalysis = async () => {
    setLoadingAxiom(true);
    try {
      const response = await apiRequest.get<AxiomAnalysis>('/admin/data-export/axiom-analysis');
      setAxiomAnalysis(response.success && response.data ? response.data : null);
    } catch (error) {
      console.error('Errore caricamento Axiom:', error);
      setAxiomAnalysis(null);
    } finally {
      setLoadingAxiom(false);
    }
  };

  const loadSecurityEventsStats = async () => {
    setLoadingSecurityEvents(true);
    try {
      const response = await apiRequest.get('/admin/data-export/security-events-stats');
      setSecurityEventsStats(response.success && response.data ? response.data : null);
    } catch (error) {
      console.error('Errore caricamento statistiche security events:', error);
      setSecurityEventsStats(null);
    } finally {
      setLoadingSecurityEvents(false);
    }
  };

  const pollExportStatus = () => {
    const poll = async () => {
      try {
        const response = await apiRequest.get<ExportStatus>('/admin/data-export/status');
        if (!response.success || !response.data) {
          setExportStatus((previous) => ({ ...previous, isRunning: false, error: response.error || 'Errore lettura stato export' }));
          return;
        }

        setExportStatus(response.data);
        if (response.data.isRunning) {
          window.setTimeout(poll, 2000);
          return;
        }

        await loadExportHistory();
        if (response.data.progress === 100 && !response.data.error) {
          toast({
            title: 'Export completato',
            description: `Esportati ${Number(response.data.exportedRecords || 0).toLocaleString('it-IT')} record`,
          });
        }
      } catch (error) {
        console.error('Errore polling status:', error);
        setExportStatus((previous) => ({ ...previous, isRunning: false, error: 'Errore comunicazione server' }));
      }
    };
    poll();
  };

  const startExport = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: 'Nessuna tabella selezionata',
        description: 'Seleziona almeno una tabella da esportare.',
        variant: 'destructive',
      });
      return;
    }

    setExportStatus({ ...EMPTY_STATUS, isRunning: true, totalTables: selectedTables.length });
    try {
      const response = await apiRequest.post('/admin/data-export/start', {
        tables: selectedTables,
        deleteAfterExport,
        dryRun,
      });
      if (!response.success) throw new Error(response.error || 'Errore avvio export');

      toast({
        title: 'Export avviato',
        description: `Export di ${selectedTables.length} tabella/e avviato.`,
      });
      pollExportStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      setExportStatus((previous) => ({ ...previous, isRunning: false, error: message }));
      toast({ title: 'Errore avvio export', description: message, variant: 'destructive' });
    }
  };

  const stopExport = async () => {
    try {
      const response = await apiRequest.post('/admin/data-export/stop');
      if (!response.success) throw new Error(response.error || 'Impossibile interrompere l\'export');
      setExportStatus((previous) => ({ ...previous, isRunning: false }));
      toast({ title: 'Export interrotto' });
    } catch (error) {
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Impossibile interrompere l\'export',
        variant: 'destructive',
      });
    }
  };

  const downloadExport = async (exportId: string) => {
    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Sessione non disponibile',
        description: 'Accedi di nuovo prima di scaricare un export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/admin/data-export/download/${encodeURIComponent(exportId)}`), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Download fallito (HTTP ${response.status})`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export_${exportId}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile scaricare il file';
      console.error('Errore download:', error);
      toast({ title: 'Errore download', description: message, variant: 'destructive' });
    }
  };

  const testAuth = async () => {
    try {
      const response = await apiRequest.get('/admin/axiom-migration/test-auth');
      if (!response.success) throw new Error(response.error || 'Autenticazione fallita');
      toast({ title: 'Autenticazione OK', description: 'Sessione Admin valida.' });
    } catch (error) {
      toast({
        title: 'Errore autenticazione',
        description: error instanceof Error ? error.message : 'Autenticazione fallita',
        variant: 'destructive',
      });
    }
  };

  const startAxiomMigration = async (onlyCentralizedLogs = false) => {
    try {
      const authTest = await apiRequest.get('/admin/axiom-migration/test-auth');
      if (!authTest.success) {
        toast({
          title: 'Errore autenticazione',
          description: 'La sessione Admin non è valida. Effettua di nuovo il login.',
          variant: 'destructive',
        });
        return;
      }
    } catch (_error) {
      toast({ title: 'Errore autenticazione', description: 'Impossibile verificare la sessione Admin.', variant: 'destructive' });
      return;
    }

    const label = onlyCentralizedLogs ? 'centralized_logs' : 'centralized_logs e audit_logs';
    if (!window.confirm(`Vuoi avviare la migrazione di ${label} da Neon ad Axiom?`)) return;

    setMigrating(true);
    try {
      const response = await apiRequest.post(
        '/admin/axiom-migration/migrate',
        { tables: onlyCentralizedLogs ? ['centralized_logs'] : ['centralized_logs', 'audit_logs'], dryRun: false },
        { timeout: 30000 },
      );
      if (!response.success) throw new Error(response.error || response.message || 'Impossibile avviare la migrazione');
      toast({ title: 'Migrazione avviata', description: response.message || 'Migrazione avviata in background.' });
      window.setTimeout(() => {
        loadAxiomAnalysis();
        loadDatabaseAnalysis();
      }, 10000);
    } catch (error) {
      toast({
        title: 'Errore avvio migrazione',
        description: error instanceof Error ? error.message : 'Impossibile avviare la migrazione',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  const statusIcon = (status: ExportHistory['status']) => {
    if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'failed') return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
  };

  const statusBadge = (status: ExportHistory['status']) => {
    if (status === 'completed') return <Badge>Completato</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Fallito</Badge>;
    return <Badge variant="secondary">In corso</Badge>;
  };

  const categoryRows = Object.values(databaseAnalysis?.categories || {}).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full p-4 space-y-4 pt-20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Export Dati</h1>
            <p className="text-gray-600 mt-2">
              Esporta dati reali dal database Neon e controlla le migrazioni verso Axiom.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-8 w-8 text-blue-500" />
            <Database className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Questa pagina non usa dati simulati: se il backend non risponde, lo stato viene mostrato come non disponibile invece di inventare valori.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="analysis" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analysis">Analisi</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="history">Cronologia</TabsTrigger>
            <TabsTrigger value="settings">Impostazioni</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-6">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadDatabaseAnalysis();
                  loadAxiomAnalysis();
                  loadSecurityEventsStats();
                }}
                disabled={loadingAnalysis || loadingAxiom || loadingSecurityEvents}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(loadingAnalysis || loadingAxiom || loadingSecurityEvents) ? 'animate-spin' : ''}`} />
                Aggiorna
              </Button>
              <Button variant={autoRefresh ? 'default' : 'outline'} size="sm" onClick={() => setAutoRefresh((value) => !value)}>
                <Clock className="h-4 w-4 mr-2" />
                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Neon Database</CardTitle>
                  <CardDescription>Dimensione reale restituita dal backend DEMOS.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAnalysis ? (
                    <p className="text-sm text-gray-500">Caricamento...</p>
                  ) : databaseAnalysis ? (
                    <>
                      <div className="text-3xl font-bold">{databaseAnalysis.totalDatabaseSizePretty || `${databaseAnalysis.totalDatabaseSizeMB || 0} MB`}</div>
                      <p className="text-sm text-gray-500 mt-1">Database applicativo principale</p>
                    </>
                  ) : (
                    <Badge variant="outline">Non disponibile</Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Axiom</CardTitle>
                  <CardDescription>Dati di logging e sicurezza già presenti sulla piattaforma.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAxiom ? (
                    <p className="text-sm text-gray-500">Caricamento...</p>
                  ) : axiomAnalysis ? (
                    <div className="space-y-1">
                      <div className="text-3xl font-bold">{Number(axiomAnalysis.totalDataSizeMB || 0).toFixed(2)} MB</div>
                      <p className="text-sm text-gray-500">{Number(axiomAnalysis.totalEvents || 0).toLocaleString('it-IT')} eventi · {axiomAnalysis.datasets?.length || 0} dataset</p>
                    </div>
                  ) : (
                    <Badge variant="outline">Non disponibile</Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {databaseAnalysis && categoryRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribuzione dati su Neon</CardTitle>
                  <CardDescription>Categorie e tabelle restituite dall'analisi del database.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {categoryRows.map((category, index) => (
                    <div key={`${category.name || 'categoria'}-${index}`} className="rounded-lg border p-3">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{category.name || 'Categoria'}</span>
                        <span className="font-semibold">{Number(category.totalSizeMB || 0).toFixed(2)} MB</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{category.tables?.length || 0} tabelle · {category.percentage ?? 0}%</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Migrazione Neon → Axiom</CardTitle>
                <CardDescription>Azioni amministrative esistenti, con conferme esplicite per le operazioni distruttive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={testAuth}>Verifica sessione Admin</Button>
                  <Button onClick={() => startAxiomMigration(false)} disabled={migrating}>Migra log verso Axiom</Button>
                  <Button variant="outline" onClick={() => startAxiomMigration(true)} disabled={migrating}>Migra solo centralized_logs</Button>
                  <p className="text-sm text-amber-700" role="status">
                    Eliminazione da Neon sospesa: verifica indipendente dell'archivio Axiom e policy RP-10 non approvate.
                  </p>
                </div>

                {axiomAnalysis?.datasets?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {axiomAnalysis.datasets.map((dataset) => (
                      <div key={dataset.name} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{dataset.label || dataset.name}</span>
                          <Badge variant="outline">{dataset.dataSizeMB != null ? `${dataset.dataSizeMB.toFixed(2)} MB` : `${Number(dataset.count || 0).toLocaleString('it-IT')} eventi`}</Badge>
                        </div>
                        {dataset.error && <p className="text-xs text-amber-700 mt-2">{dataset.error}</p>}
                      </div>
                    ))}
                  </div>
                ) : null}

                {securityEventsStats && (
                  <div className="rounded-lg border p-3">
                    <div className="font-medium">Security Events</div>
                    <p className="text-sm text-gray-600 mt-1">
                      {Number(securityEventsStats.totalEvents || 0).toLocaleString('it-IT')} eventi · {Number(securityEventsStats.dataSizeMB || 0).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            {exportStatus.isRunning && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" /> Export in corso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm"><span>Progresso</span><span>{exportStatus.progress}%</span></div>
                  <Progress value={exportStatus.progress} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium">Tabella:</span> {exportStatus.currentTable || 'Inizializzazione...'}</div>
                    <div><span className="font-medium">Record:</span> {Number(exportStatus.exportedRecords || 0).toLocaleString('it-IT')} / {Number(exportStatus.totalRecords || 0).toLocaleString('it-IT')}</div>
                  </div>
                  <Button variant="outline" onClick={stopExport}><Pause className="h-4 w-4 mr-2" />Interrompi export</Button>
                </CardContent>
              </Card>
            )}

            {exportStatus.error && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{exportStatus.error}</AlertDescription></Alert>
            )}

            {tablesError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{tablesError} Nessun dato simulato è stato mostrato.</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Seleziona tabelle</CardTitle>
                    <CardDescription>Vengono mostrate esclusivamente le tabelle restituite dal backend.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/admin/data-export/centralized-logs"><Button variant="outline" size="sm"><List className="h-4 w-4 mr-2" />Visualizza log</Button></Link>
                    <Button variant="outline" size="sm" onClick={loadTableInfo} disabled={loadingTables}><RefreshCw className={`h-4 w-4 ${loadingTables ? 'animate-spin' : ''}`} /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Cerca tabella..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedTables(tables.filter((table) => table.enabled).map((table) => table.name))}>Seleziona tutte</Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedTables([])}>Deseleziona tutte</Button>
                </div>

                {loadingTables ? (
                  <p className="text-sm text-gray-500 py-6">Caricamento tabelle reali...</p>
                ) : filteredTables.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6">Nessuna tabella disponibile.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredTables.map((table) => (
                      <div key={table.name} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTables.includes(table.name)}
                            onChange={(event) => {
                              setSelectedTables((current) => event.target.checked ? [...current, table.name] : current.filter((name) => name !== table.name));
                            }}
                            className="h-4 w-4 mt-1"
                          />
                          <div>
                            <div className="font-medium">{table.name}</div>
                            <p className="text-sm text-gray-600">{Number(table.recordCount || 0).toLocaleString('it-IT')} record · {formatSize(table.sizeMB, table.sizeKB)}</p>
                            <p className="text-xs text-gray-500 mt-1">{tableDescription(table.name)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={table.enabled ? 'default' : 'secondary'}>{table.enabled ? 'Abilitata' : 'Disabilitata'}</Badge>
                          <Badge variant="outline">{table.retentionDays} giorni</Badge>
                          {Number(table.exportableRecords || 0) > 0 && <Badge variant="outline">{Number(table.exportableRecords).toLocaleString('it-IT')} esportabili</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Opzioni export</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-amber-700">Export su disco temporaneamente non disponibile: verifica GDPR e conservazione dati in corso.</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={deleteAfterExport} disabled />
                  Elimina dal database dopo l'export
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
                  Modalità test (solo conteggi, nessun file creato)
                </label>
                <Button onClick={startExport} disabled={true}>
                  <Download className="h-4 w-4 mr-2" />{dryRun ? 'Simula export' : 'Avvia export'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Cronologia export</CardTitle>
                <CardDescription>I download richiedono la sessione Admin autenticata.</CardDescription>
              </CardHeader>
              <CardContent>
                {exportHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500"><FileText className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Nessun export disponibile</p></div>
                ) : (
                  <div className="space-y-3">
                    {exportHistory.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          {statusIcon(item.status)}
                          <div>
                            <div className="font-medium">Export del {item.date}</div>
                            <p className="text-sm text-gray-600">{Number(item.totalRecords || 0).toLocaleString('it-IT')} record · {item.totalFiles} file · {item.tables} tabelle</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge(item.status)}
                          {item.status === 'completed' && <Button size="sm" variant="outline" onClick={() => downloadExport(item.id)}><Download className="h-4 w-4 mr-1" />Download</Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Impostazioni export</CardTitle>
                <CardDescription>Configurazione operativa mostrata dalla pagina Admin.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border p-3"><div className="font-medium">Destinazione</div><code>/mnt/external-drive/archivio</code></div>
                <div className="rounded-lg border p-3"><div className="font-medium">Compressione</div><span>GZIP Level 6</span></div>
                <div className="rounded-lg border p-3"><div className="font-medium">Formato</div><span>CSV</span></div>
                <div className="rounded-lg border p-3"><div className="font-medium">Dimensione max file</div><span>100 MB</span></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
