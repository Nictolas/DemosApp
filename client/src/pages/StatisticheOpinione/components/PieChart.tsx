import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { COLORS } from "../constants";
import { PieDataItem } from "../types";

interface PieChartProps {
  pieData: PieDataItem[];
}

export const PieChartComponent: React.FC<PieChartProps> = ({ pieData }) => {
  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Distribuzione Voti</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {pieData.some(item => item.value > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie 
                data={pieData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={120} 
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Nessun dato disponibile
          </div>
        )}
      </CardContent>
    </Card>
  );
};
