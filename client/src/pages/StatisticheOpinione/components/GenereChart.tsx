import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

  // Prepara i dati per i grafici a torta
  const favorevoliData = genereData
    .filter(item => (parseInt(item.favorevole) || 0) > 0)
    .map(item => ({
      name: item.fascia_eta || item.genere || 'N/A',
      value: parseInt(item.favorevole) || 0,
      color: '#10b981'
    }));

  const contrariData = genereData
    .filter(item => (parseInt(item.contrario) || 0) > 0)
    .map(item => ({
      name: item.fascia_eta || item.genere || 'N/A',
      value: parseInt(item.contrario) || 0,
      color: '#ef4444'
    }));

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6b7280'];

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Grafico Favorevoli */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Favorevoli</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={favorevoliData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {favorevoliData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {favorevoliData.length === 0 && (
              <p className="text-gray-500 mt-4">Nessun dato favorevole</p>
            )}
          </div>

          {/* Grafico Contrari */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contrari</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={contrariData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {contrariData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {contrariData.length === 0 && (
              <p className="text-gray-500 mt-4">Nessun dato contrario</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
