import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Building2, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { hasAdminCapability } from "@/lib/admin-access";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MinisteroData {
  success: boolean;
  data: any;
  iniziative?: any[];
  statistiche?: {
    totaleIniziative: number;
    totaleFirme: number;
    iniziativePerStato: Record<string, number>;
    iniziativePerTipo: Record<string, number>;
  };
  timestamp?: string;
  source?: string;
  error?: string;
  message?: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

export default function TestMinistero() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<MinisteroData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Prepara i dati per i grafici
  const chartDataPerStato = useMemo(() => {
    if (!data?.statistiche?.iniziativePerStato) return [];
    return Object.entries(data.statistiche.iniziativePerStato).map(([name, value]) => ({
      name,
      value
    }));
  }, [data]);

  const chartDataPerTipo = useMemo(() => {
    if (!data?.statistiche?.iniziativePerTipo) return [];
    return Object.entries(data.statistiche.iniziativePerTipo).map(([name, value]) => ({
      name,
      value
    }));
  }, [data]);

  // Calcola le colonne della tabella una volta sola
  const tableColumns = useMemo(() => {
    const items = data?.iniziative || (Array.isArray(data?.data) ? data.data : []);
    if (items.length === 0) return [];
    
    const allKeys = new Set<string>();
    items.forEach((item: any) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(key => {
          if (item[key] !== null && typeof item[key] !== 'object') {
            allKeys.add(key);
          } else if (item[key] && typeof item[key] === 'object' && !Array.isArray(item[key])) {
            Object.keys(item[key]).forEach(subKey => {
              allKeys.add(`${key}.${subKey}`);
            });
          }
        });
      }
    });
    
    const priority = ['id', 'id_ministero', 'titolo', 'descrizione', 'tipo', 'stato', 'firme_raccolte', 'sostenitori', 'quorum', 'quorum_raggiunto', 'data_inizio', 'data_fine', 'sito_web', 'promotore'];
    return Array.from(allKeys).sort((a, b) => {
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [data]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result: MinisteroData = await apiRequest("GET", "/api/ministero/iniziative");
      
      if (!result || !result.success) {
        throw new Error(result?.error || result?.message || 'Errore nel recupero dei dati');
      }

      setData(result);
      setLastUpdate(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto durante il recupero dei dati';
      setError(errorMessage);
      console.error('Errore nel recupero dati Ministero:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Carica i dati all'avvio
  useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [user, authLoading]);

  // Aggiorna automaticamente i dati ogni 5 minuti (300000 ms)
  // Questo permette di vedere gli aggiornamenti del quorum senza dover ricaricare manualmente
  // Il backend si sincronizza automaticamente ogni 6 ore dal Ministero
  useEffect(() => {
    if (!user || authLoading || !autoRefreshEnabled) return;

    const intervalId = setInterval(() => {
      console.log('🔄 Aggiornamento automatico dati Ministero (ogni 5 minuti)...');
      fetchData();
    }, 5 * 60 * 1000); // 5 minuti

    return () => clearInterval(intervalId);
  }, [user, authLoading, autoRefreshEnabled]);

  if (authLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!hasAdminCapability(user)) {
    return <Redirect to="/menu" />;
  }

  return (
    <PageContainer className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-6 w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-slate-600" />
              <h1 className="text-3xl font-bold text-gray-900">Test Ministero</h1>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdate && (
                <span className="text-sm text-gray-500">
                  Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
                </span>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh (5 min)
              </label>
            </div>
          </div>
          <p className="text-gray-600">
            Test dell'integrazione con l'API del Ministero della Giustizia per iniziative e firme
          </p>
          <p className="text-sm text-gray-500 mt-1">
            📊 Il backend si sincronizza automaticamente ogni 6 ore dal Ministero. 
            Il frontend si aggiorna automaticamente ogni 5 minuti per mostrare i dati più recenti dal database.
          </p>
        </div>

        {/* Pulsanti */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Caricamento...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Aggiorna Dati</span>
              </>
            )}
          </button>
          
          <button
            onClick={async () => {
              setIsLoading(true);
              setError(null);
              try {
                const result = await apiRequest("POST", "/api/ministero/sync");
                if (result && result.success) {
                  alert(`✅ Sincronizzazione completata!\n\n• Nuove iniziative create: ${result.results?.created || 0}\n• Iniziative aggiornate: ${result.results?.updated || 0}\n• Errori: ${result.results?.errors || 0}\n\nClicca su "Aggiorna Dati" per vedere i dati sincronizzati.`);
                  // Ricarica i dati dopo la sincronizzazione
                  setTimeout(() => fetchData(), 1000);
                } else {
                  throw new Error(result?.error || 'Errore nella sincronizzazione');
                }
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
                setError(errorMessage);
                console.error('Errore sincronizzazione:', err);
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Sincronizza con Ministero</span>
          </button>
        </div>

        {/* Stato di caricamento */}
        {isLoading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-slate-600" />
              <p className="text-gray-600">Caricamento dati dal Ministero...</p>
            </div>
          </div>
        )}

        {/* Errore */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Errore</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dati ricevuti */}
        {data && !error && (
          <div className="space-y-6">
            {/* Informazioni generali */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 mb-1">Connessione Riuscita</h3>
                  <p className="text-green-700 text-sm">
                    Dati ricevuti da: {data.source || 'Ministero della Giustizia'}
                  </p>
                  {data.timestamp && (
                    <p className="text-green-600 text-xs mt-1">
                      Ultimo aggiornamento: {new Date(data.timestamp).toLocaleString('it-IT')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Statistiche - sempre mostrate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Totale Iniziative</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {data.statistiche?.totaleIniziative ?? 0}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Totale Firme</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {(data.statistiche?.totaleFirme ?? 0).toLocaleString('it-IT')}
                </p>
              </div>
            </div>

            {/* Grafici - sempre mostrati, anche con dati vuoti */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Grafico per Stato */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Iniziative per Stato</h2>
                {chartDataPerStato.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartDataPerStato}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Grafico per Tipo */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Iniziative per Tipo</h2>
                {chartDataPerTipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartDataPerTipo}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {chartDataPerTipo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      />
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Link per vedere dati dal database e log */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 mb-2">
                💡 <strong>Suggerimento:</strong> Dopo aver sincronizzato, puoi vedere i dati salvati nel database cliccando i pulsanti qui sotto.
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    setError(null);
                    try {
                      const result = await apiRequest("GET", "/api/ministero/database");
                      if (result && result.success) {
                        // Mostra i dati dal database invece di quelli dall'API
                        setData({
                          ...data,
                          iniziative: result.data || [],
                          statistiche: {
                            totaleIniziative: result.count || 0,
                            totaleFirme: result.data?.reduce((sum: number, item: any) => sum + (item.firme_raccolte || 0), 0) || 0,
                            iniziativePerStato: {},
                            iniziativePerTipo: {}
                          }
                        });
                      }
                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
                      setError(errorMessage);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  Vedi Dati dal Database
                </button>
                <button
                  onClick={async () => {
                    try {
                      const result = await apiRequest("GET", "/api/ministero/logs");
                      if (result && result.success) {
                        setSyncLogs(result.logs || []);
                        console.log('📋 Log di sincronizzazione:', result.logs);
                      } else {
                        console.log('📋 Info log:', result);
                        setSyncLogs([]);
                        alert(result.message || 'I log sono disponibili nella console del server o su Render.com');
                      }
                    } catch (err) {
                      console.error('Errore nel recupero log:', err);
                      setSyncLogs([]);
                      alert('Impossibile recuperare i log dal database. I log dettagliati sono disponibili nella console del server.');
                    }
                  }}
                  disabled={isLoading}
                  className="text-sm px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  Vedi Log Sincronizzazione
                </button>
              </div>
            </div>

            {/* Log di sincronizzazione */}
            {syncLogs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Log Sincronizzazione ({syncLogs.length} log trovati)
                </h2>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {syncLogs.map((log: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded border text-sm ${
                        log.level === 'ERROR' || log.level === 'E'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : log.level === 'WARN' || log.level === 'W'
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                          : 'bg-gray-50 border-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-semibold">
                          {new Date(log.timestamp).toLocaleString('it-IT')}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-200">
                          {log.level || 'INFO'}
                        </span>
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap">
                        {log.message || JSON.stringify(log.meta || log, null, 2)}
                      </div>
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-800">
                            Dettagli aggiuntivi
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabella con tutte le colonne */}
            {(data.iniziative && data.iniziative.length > 0) || (data.data && Array.isArray(data.data) && data.data.length > 0) ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Tabella Iniziative ({data.iniziative?.length || (Array.isArray(data.data) ? data.data.length : 0)} elementi)
                </h2>
                <div className="overflow-x-auto w-full">
                  <table className="min-w-full divide-y divide-gray-200 border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        {tableColumns.map((key) => (
                          <th
                            key={key}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 whitespace-nowrap"
                          >
                            {key.replace(/_/g, ' ').replace(/\./g, ' → ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(data.iniziative || (Array.isArray(data.data) ? data.data : [])).map((item: any, index: number) => {
                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {tableColumns.map((key) => {
                              let value: any = null;
                              
                              // Gestisci chiavi nidificate
                              if (key.includes('.')) {
                                const [parentKey, childKey] = key.split('.');
                                value = item[parentKey]?.[childKey];
                              } else {
                                value = item[key];
                              }
                              
                              // Formatta il valore
                              let displayValue = '';
                              if (value === null || value === undefined) {
                                displayValue = '-';
                              } else if (typeof value === 'boolean') {
                                displayValue = value ? 'Sì' : 'No';
                              } else if (typeof value === 'number') {
                                displayValue = value.toLocaleString('it-IT');
                              } else if (typeof value === 'string' && value.length > 100) {
                                displayValue = value.substring(0, 100) + '...';
                              } else {
                                displayValue = String(value);
                              }
                              
                              return (
                                <td
                                  key={key}
                                  className="px-4 py-3 text-sm text-gray-900 border border-gray-200 whitespace-nowrap"
                                  title={typeof value === 'string' && value.length > 100 ? value : undefined}
                                >
                                  {displayValue}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 text-center">
                  <p className="text-gray-500">Nessun dato disponibile per la tabella</p>
                </div>
              </div>
            )}

            {/* Dati raw completi (per debug) */}
            <details className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                Dati Raw Completi (Debug)
              </summary>
              <pre className="text-xs overflow-x-auto text-gray-800 mt-2 p-4 bg-white rounded border border-gray-200">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Nessun dato */}
        {!data && !isLoading && !error && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-600">Nessun dato disponibile. Clicca su "Aggiorna Dati" per recuperare le informazioni.</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

