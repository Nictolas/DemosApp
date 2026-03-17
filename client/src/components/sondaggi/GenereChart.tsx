import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface GenereChartProps {
  genereData: any;
  colors: string[];
}

export function GenereChart({ genereData, colors }: GenereChartProps) {
  if (!genereData) return null;

  const generePieData = [
    { name: 'Uomo', value: parseInt(genereData.uomo) || 0 },
    { name: 'Donna', value: parseInt(genereData.donna) || 0 },
    { name: 'Altro', value: parseInt(genereData.altro) || 0 },
  ].filter(item => item.value > 0);

  if (generePieData.length === 0) return null;

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Distribuzione per Genere</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={generePieData} 
              dataKey="value" 
              nameKey="name" 
              cx="50%" 
              cy="50%" 
              outerRadius={120} 
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {generePieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
