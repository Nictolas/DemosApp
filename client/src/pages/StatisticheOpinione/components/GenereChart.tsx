import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users } from "lucide-react";
import { EtaDataItem } from "../types";

interface GenereChartProps {
  genereData: EtaDataItem[];
}

export function GenereChart({ genereData }: GenereChartProps) {
  if (!genereData || genereData.length === 0) {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-gray-800 flex items-center">
            <Users className="mr-2 h-6 w-6 text-blue-600" />
            Distribuzione per Genere
          </CardTitle>
          <CardDescription className="text-gray-600">
            Analisi delle opinioni per genere
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500 py-8">
            Nessun dato disponibile per il genere
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepara i dati per il grafico
  const chartData = genereData.map(item => ({
    genere: item.fascia_eta || item.genere || 'N/A',
    Favorevole: parseInt(item.favorevole) || 0,
    Contrario: parseInt(item.contrario) || 0,
    Indeciso: parseInt(item.indeciso) || 0,
    Astenuto: parseInt(item.astenuto) || 0,
  }));

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-gray-800 flex items-center">
          <Users className="mr-2 h-6 w-6 text-blue-600" />
          Distribuzione per Genere
        </CardTitle>
        <CardDescription className="text-gray-600">
          Analisi delle opinioni per genere
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="genere" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Bar dataKey="Favorevole" fill="#10b981" name="Favorevole" />
            <Bar dataKey="Contrario" fill="#ef4444" name="Contrario" />
            <Bar dataKey="Indeciso" fill="#f59e0b" name="Indeciso" />
            <Bar dataKey="Astenuto" fill="#6b7280" name="Astenuto" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
