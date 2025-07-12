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
import { analytics, perf, logEvent } from "../lib/firebase";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Tipi per i dati Firebase
interface FirebaseConsumi {
  timestamp?: string;
  error?: string;
  firestoreReads?: {
    timeSeries: {
      points: {
        value: { int64Value: string };
      }[];
    }[];
    error?: string;
  };
  firestoreWrites?: {
    timeSeries: {
      points: {
        value: { int64Value: string };
      }[];
    }[];
    error?: string;
  };
  functionsInvocations?: {
    timeSeries: {
      points: {
        value: { int64Value: string };
      }[];
    }[];
    error?: string;
  };
  hostingRequests?: {
    timeSeries: {
      points: {
        value: { int64Value: string };
      }[];
    }[];
    error?: string;
  };
  storageObjects?: {
    timeSeries: {
      points: {
        value: { int64Value: string };
      }[];
    }[];
    error?: string;
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
      const response = await fetch('https://us-central1-demos-finale.cloudfunctions.net/monitoring');
      const data = await response.json();
      setFirebaseConsumi(data);
    } catch (error) {
      setFirebaseConsumi({ error: 'Errore nel recupero dati dalla Cloud Function' });
    }
  };

  useEffect(() => {
    fetchData();
    fetchFirebaseConsumi();
    // Traccia la visualizzazione della pagina
    if (analytics) {
      logEvent(analytics, "page_view", { page: "AnalisiConsumi" });
    }
    // RIMOSSO: custom trace per Performance Monitoring (non supportato su web)
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
                      Ultimo aggiornamento: {firebaseConsumi && firebaseConsumi.timestamp ? new Date(firebaseConsumi.timestamp).toLocaleString('it-IT') : 'N/A'}
                    </div>
                    <Button onClick={fetchFirebaseConsumi} disabled={loading} variant="outline" size="sm">
                      {loading ? 'Aggiornamento...' : 'Aggiorna Firebase'}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Firestore */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h4 className="font-semibold text-blue-800 mb-2">Firestore</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Letture:</span>
                        <span className="font-mono">{
                          firebaseConsumi.firestoreReads &&
                          firebaseConsumi.firestoreReads.timeSeries &&
                          firebaseConsumi.firestoreReads.timeSeries[0] &&
                          firebaseConsumi.firestoreReads.timeSeries[0].points
                            ? firebaseConsumi.firestoreReads.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0)
                            : 'Nessun dato disponibile'
                        }</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scritture:</span>
                        <span className="font-mono">{
                          firebaseConsumi.firestoreWrites &&
                          firebaseConsumi.firestoreWrites.timeSeries &&
                          firebaseConsumi.firestoreWrites.timeSeries[0] &&
                          firebaseConsumi.firestoreWrites.timeSeries[0].points
                            ? firebaseConsumi.firestoreWrites.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0)
                            : 'Nessun dato disponibile'
                        }</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Totale:</span>
                        <span className="font-mono">{
                          firebaseConsumi.firestoreReads &&
                          firebaseConsumi.firestoreReads.timeSeries &&
                          firebaseConsumi.firestoreReads.timeSeries[0] &&
                          firebaseConsumi.firestoreReads.timeSeries[0].points &&
                          firebaseConsumi.firestoreWrites &&
                          firebaseConsumi.firestoreWrites.timeSeries &&
                          firebaseConsumi.firestoreWrites.timeSeries[0] &&
                          firebaseConsumi.firestoreWrites.timeSeries[0].points
                            ? firebaseConsumi.firestoreReads.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0) +
                              firebaseConsumi.firestoreWrites.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0)
                            : 'Nessun dato disponibile'
                        }</span>
                      </div>
                      {firebaseConsumi.firestoreReadsError && <div className="text-xs text-red-600">{firebaseConsumi.firestoreReadsError}</div>}
                      {firebaseConsumi.firestoreWritesError && <div className="text-xs text-red-600">{firebaseConsumi.firestoreWritesError}</div>}
                    </div>
                  </div>
                  {/* Cloud Functions */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <h4 className="font-semibold text-green-800 mb-2">Cloud Functions</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Invocazioni:</span>
                        <span className="font-mono">{
                          firebaseConsumi.functionsInvocations &&
                          firebaseConsumi.functionsInvocations.timeSeries &&
                          firebaseConsumi.functionsInvocations.timeSeries[0] &&
                          firebaseConsumi.functionsInvocations.timeSeries[0].points
                            ? firebaseConsumi.functionsInvocations.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0)
                            : 'Nessun dato disponibile'
                        }</span>
                      </div>
                      {firebaseConsumi.functionsInvocationsError && <div className="text-xs text-red-600">{firebaseConsumi.functionsInvocationsError}</div>}
                    </div>
                  </div>
                  {/* Hosting */}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <h4 className="font-semibold text-purple-800 mb-2">Hosting</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Richieste:</span>
                        <span className="font-mono">{
                          firebaseConsumi.hostingRequests &&
                          firebaseConsumi.hostingRequests.timeSeries &&
                          firebaseConsumi.hostingRequests.timeSeries[0] &&
                          firebaseConsumi.hostingRequests.timeSeries[0].points
                            ? firebaseConsumi.hostingRequests.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0)
                            : 'Nessun dato disponibile'
                        }</span>
                      </div>
                      {firebaseConsumi.hostingRequestsError && <div className="text-xs text-red-600">{firebaseConsumi.hostingRequestsError}</div>}
                    </div>
                  </div>
                  {/* Storage */}
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h4 className="font-semibold text-yellow-800 mb-2">Storage</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Oggetti:</span>
                        <span className="font-mono">{
                          firebaseConsumi.storageObjects &&
                          firebaseConsumi.storageObjects.timeSeries &&
                          firebaseConsumi.storageObjects.timeSeries[0] &&
                          firebaseConsumi.storageObjects.timeSeries[0].points
                            ? firebaseConsumi.storageObjects.timeSeries[0].points.reduce(
                                (acc, p) => acc + parseInt(p.value.int64Value || "0", 10), 0)
                            : 'Nessun dato disponibile'
                        }</span>
                      </div>
                      {firebaseConsumi.storageObjectsError && <div className="text-xs text-red-600">{firebaseConsumi.storageObjectsError}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 