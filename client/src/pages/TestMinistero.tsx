import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Building2, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result: MinisteroData = await apiRequest("GET", "/api/ministero/iniziative");
      
      if (!result || !result.success) {
        throw new Error(result?.error || result?.message || 'Errore nel recupero dei dati');
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto durante il recupero dei dati';
      setError(errorMessage);
      console.error('Errore nel recupero dati Ministero:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [user, authLoading]);

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

  return (
    <PageContainer className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-slate-600" />
            <h1 className="text-3xl font-bold text-gray-900">Test Ministero</h1>
          </div>
          <p className="text-gray-600">
            Test dell'integrazione con l'API del Ministero della Giustizia per iniziative e firme
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

            {/* Link per vedere dati dal database */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 mb-2">
                💡 <strong>Suggerimento:</strong> Dopo aver sincronizzato, puoi vedere i dati salvati nel database cliccando il pulsante qui sotto.
              </p>
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
            </div>

            {/* Dati strutturati */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Dati Ricevuti</h2>
              
              {data.iniziative && data.iniziative.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Numero di iniziative trovate: <strong>{data.iniziative.length}</strong>
                  </p>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.iniziative.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        <pre className="text-xs overflow-x-auto text-gray-800">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : data.data ? (
                <div className="space-y-4">
                  {/* Se i dati sono un array */}
                  {Array.isArray(data.data) ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Numero di elementi trovati: <strong>{data.data.length}</strong>
                      </p>
                      {data.data.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {data.data.map((item: any, index: number) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                            >
                              <pre className="text-xs overflow-x-auto text-gray-800">
                                {JSON.stringify(item, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 text-center">
                          <p className="text-gray-500">Nessun dato disponibile</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Se i dati sono un oggetto */
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <pre className="text-xs overflow-x-auto text-gray-800">
                        {JSON.stringify(data.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 text-center">
                  <p className="text-gray-500">Nessun dato disponibile</p>
                </div>
              )}
            </div>

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

