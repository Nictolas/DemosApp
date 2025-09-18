import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart as BarChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface Question {
  id: string;
  text: string;
}

interface SondaggiChartsProps {
  questions: Question[];
  barChartData: Array<{
    name: string;
    Favorevole: number;
    Contrario: number;
    Indeciso: number;
    Astenuto: number;
  }>;
  preparePieData: (questionKey: string) => Array<{
    name: string;
    value: number;
    color: string;
  }>;
  colors: {
    favorevole: string;
    contrario: string;
    indeciso: string;
    astenuto: string;
  };
}

export function SondaggiCharts({ 
  questions, 
  barChartData, 
  preparePieData, 
  colors 
}: SondaggiChartsProps) {
  return (
    <>
      {/* Grafico a barre principale */}
      {barChartData && barChartData.length > 0 && (
        <Card className="bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-2xl text-gray-800 flex items-center">
              <BarChartIcon className="mr-2 h-6 w-6 text-blue-600" />
              Distribuzione delle Opinioni
            </CardTitle>
            <CardDescription className="text-gray-600">
              Panoramica delle opinioni espresse dagli utenti
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar dataKey="Favorevole" fill={colors.favorevole} name="Favorevole" />
                <Bar dataKey="Contrario" fill={colors.contrario} name="Contrario" />
                <Bar dataKey="Indeciso" fill={colors.indeciso} name="Indeciso" />
                <Bar dataKey="Astenuto" fill={colors.astenuto} name="Astenuto" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Grafici a torta per singole domande */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {questions
          .filter(q => q.text && q.text.trim() !== '')
          .map(q => {
            const pieData = preparePieData(q.id);
            
            if (pieData.length === 0) {
              return null;
            }
            
            return (
              <Card key={q.id} className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                  onClick={() => window.location.href = `/statistiche-opinione/${q.id}`}
                >
                  <CardTitle className="text-lg text-gray-800 hover:text-blue-600 transition-colors">
                    {q.text}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={pieData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
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
                  </div>
                  
                  {/* Legenda colori */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {pieData.map((entry, index) => (
                      <div key={index} className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-700">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </>
  );
}
