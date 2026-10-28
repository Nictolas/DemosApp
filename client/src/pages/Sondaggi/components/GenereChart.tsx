import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { GENERE_COLORS } from "../constants/colors";
import { PieDataItem } from "../types";

interface GenereChartProps {
  generePieData: PieDataItem[];
}

export const GenereChart: React.FC<GenereChartProps> = ({ generePieData }) => {
  if (generePieData.length === 0) return null;

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Distribuzione per sesso</CardTitle>
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
                <Cell key={`cell-${index}`} fill={GENERE_COLORS[index % GENERE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
