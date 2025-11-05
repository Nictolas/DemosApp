import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Building2, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MinisteroData {
  success: boolean;
  data: any;
  timestamp?: string;
  source?: string;
  error?: string;
  message?: string;
}

export default function TestMinistero() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<MinisteroData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        {/* Pulsante Refresh */}
        <div className="mb-6">
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

            {/* Dati strutturati */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Dati Ricevuti</h2>
              
              {data.data ? (
                <div className="space-y-4">
                  {/* Se i dati sono un array */}
                  {Array.isArray(data.data) ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Numero di iniziative trovate: <strong>{data.data.length}</strong>
                      </p>
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
                <p className="text-gray-600">Nessun dato disponibile</p>
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

