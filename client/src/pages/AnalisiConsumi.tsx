import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Info, BarChart2, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { analytics as analyticsAny, perf as perfAny, crashlytics, logEvent } from "../lib/firebase";
const analytics: any = (require("../lib/firebase").analytics as any);
const perf: any = (require("../lib/firebase").perf as any);

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Tipi per i dati Firebase
interface FirebaseConsumi {
  timestamp?: string;
  error?: string;
  firestore?: {
    reads: number;
    writes: number;
    total: number;
  };
  functions?: {
    invocations: number;
    executionTime: number;
    gbSeconds: number;
  };
  hosting?: {
    requests: number;
    bytesTransferred: number;
    gbTransferred: number;
  };
  storage?: {
    objectCount: number;
    bytesUsed: number;
    gbUsed: number;
  };
}

export default function AnalisiConsumi() {
  const [dynamicData, setDynamicData] = useState({
    bundleSize: '...',
    apiCalls: '...',
    bandwidth: '...',
    serverlessGBhr: '...',
    edgeInvocations: '...'
  });
  const [firebaseConsumi, setFirebaseConsumi] = useState<FirebaseConsumi | null>(null);
  const [chartDataState, setChartDataState] = useState([12, 18, 22, 30, 35, 41]);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/monitoring-consumi')
      .then(res => res.json())
      .then(data => {
        setDynamicData({
          bundleSize: (data.bundleSize || 0) + ' KB',
          apiCalls: (data.apiCalls || 0) + '/mese',
          bandwidth: (data.bandwidth || 0) + ' GB/mese',
          serverlessGBhr: (data.serverlessGBhr || 0) + ' GB-hr/mese',
          edgeInvocations: (data.edgeInvocations || 0) + '/mese',
        });
        if (data.trafficHistory) setChartDataState(data.trafficHistory);
      })
      .catch(() => setDynamicData({
        bundleSize: 'N/A',
        apiCalls: 'N/A',
        bandwidth: 'N/A',
        serverlessGBhr: 'N/A',
        edgeInvocations: 'N/A',
      }))
      .finally(() => setLoading(false));
  };

  const fetchFirebaseConsumi = async () => {
    try {
      const response = await fetch('/api/firebase-monitoring');
      const data = await response.json();
      setFirebaseConsumi(data);
    } catch (error) {
      console.error('Errore nel recupero consumi Firebase:', error);
      setFirebaseConsumi({ error: 'Errore nel recupero dati' });
    }
  };

  useEffect(() => {
    fetchData();
    fetchFirebaseConsumi();
    // Traccia la visualizzazione della pagina
    if (analytics) {
      logEvent(analytics, "page_view", { page: "AnalisiConsumi" });
    }
    // Esempio: logga un errore di test su Crashlytics (decommenta per test reale)
    // if (crashlytics) crashlytics.recordError(new Error("Test Crashlytics su AnalisiConsumi"));
    // Esempio: custom trace per Performance Monitoring
    if (perf) {
      const trace = perf.trace("analisi_consumi_render");
      trace.start();
      setTimeout(() => {
        trace.stop();
      }, 1000);
    }
  }, []);

  const handleAggiorna = async () => {
    setLoading(true);
    await fetch('/api/monitoring-consumi-update', {
      method: 'POST',
      headers: { 'X-API-KEY': 'supersegreto2024!' }
    });
    fetchData();
    fetchFirebaseConsumi(); // Aggiorna anche i dati Firebase
  };

  const chartData = {
    labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
    datasets: [
      {
        label: 'Traffico (GB)',
        data: chartDataState,
        backgroundColor: 'rgba(37, 99, 235, 0.6)',
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Traffico mensile (GB)' },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => window.location.href = "/gestisci"}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna a Gestisci
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <BarChart2 className="h-6 w-6 text-blue-600" />
              Analisi Consumi e Limiti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Consumi Firebase Reali */}
            {firebaseConsumi && (
              <div className="bg-white border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-orange-600" />
                    Consumi Firebase Reali
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500">
                      Ultimo aggiornamento: {firebaseConsumi.timestamp ? new Date(firebaseConsumi.timestamp).toLocaleString('it-IT') : 'N/A'}
                    </div>
                    <Button onClick={fetchFirebaseConsumi} disabled={loading} variant="outline" size="sm">
                      {loading ? 'Aggiornamento...' : 'Aggiorna Firebase'}
                    </Button>
                  </div>
                </div>
                {firebaseConsumi.error ? (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Errore nel recupero dati: {firebaseConsumi.error}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Firestore */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="font-semibold text-blue-800 mb-2">Firestore</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Letture:</span>
                          <span className="font-mono">{firebaseConsumi.firestore?.reads?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Scritture:</span>
                          <span className="font-mono">{firebaseConsumi.firestore?.writes?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Totale:</span>
                          <span className="font-mono">{firebaseConsumi.firestore?.total?.toLocaleString() || '0'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Functions */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <h4 className="font-semibold text-green-800 mb-2">Cloud Functions</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Invocazioni:</span>
                          <span className="font-mono">{firebaseConsumi.functions?.invocations?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tempo esecuzione:</span>
                          <span className="font-mono">{firebaseConsumi.functions?.executionTime?.toFixed(2) || '0'} ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GB-seconds:</span>
                          <span className="font-mono">{firebaseConsumi.functions?.gbSeconds?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Hosting */}
                    <div className="bg-purple-50 rounded-lg p-3">
                      <h4 className="font-semibold text-purple-800 mb-2">Hosting</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Richieste:</span>
                          <span className="font-mono">{firebaseConsumi.hosting?.requests?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bytes trasferiti:</span>
                          <span className="font-mono">{firebaseConsumi.hosting?.bytesTransferred?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GB trasferiti:</span>
                          <span className="font-mono">{firebaseConsumi.hosting?.gbTransferred?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Storage */}
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <h4 className="font-semibold text-yellow-800 mb-2">Storage</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Oggetti:</span>
                          <span className="font-mono">{firebaseConsumi.storage?.objectCount?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bytes utilizzati:</span>
                          <span className="font-mono">{firebaseConsumi.storage?.bytesUsed?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GB utilizzati:</span>
                          <span className="font-mono">{firebaseConsumi.storage?.gbUsed?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Dati dinamici */}
            <div className="bg-white border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">Dati dinamici (reali)</h3>
                <Button onClick={handleAggiorna} disabled={loading} variant="outline" size="sm">
                  {loading ? 'Aggiornamento...' : 'Aggiorna'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.bundleSize}</span>
                  <span className="text-xs text-gray-500">Bundle JS/CSS</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.apiCalls}</span>
                  <span className="text-xs text-gray-500">Chiamate API/Edge</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.bandwidth}</span>
                  <span className="text-xs text-gray-500">Banda usata</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.serverlessGBhr}</span>
                  <span className="text-xs text-gray-500">Serverless GB-hr</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.edgeInvocations}</span>
                  <span className="text-xs text-gray-500">Edge Invocazioni</span>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <Bar data={chartData} options={chartOptions} height={180} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 