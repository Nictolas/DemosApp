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
