import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarDataItem } from "../types";

interface BarChartProps {
  etaBarData: BarDataItem[];
}

export const BarChartComponent: React.FC<BarChartProps> = ({ etaBarData }) => {
  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Distribuzione per Età</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {etaBarData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={etaBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Favorevole" fill="#10B981" />
              <Bar dataKey="Indeciso" name="Non lo so" fill="#FCD34D" />
              <Bar dataKey="Contrario" fill="#EF4444" />
            </RechartsBarChart>
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
