import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp } from "lucide-react";
import { OpinionStats } from "../types";

interface StatsOverviewProps {
  stats: OpinionStats;
  totaleUtenti: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, totaleUtenti }) => {
  // Calcola il totale voti correttamente (solo chi ha risposto)
  const totalVotes = (parseInt(stats.favorevole) || 0) + (parseInt(stats.contrario) || 0) + (parseInt(stats.indeciso) || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-800">Favorevoli</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700">{stats.favorevole}</div>
          <p className="text-xs text-green-600">
            {totalVotes > 0 ? `${((parseInt(stats.favorevole) / totalVotes) * 100).toFixed(1)}%` : '0%'} dei voti
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-800">Contrari</CardTitle>
          <TrendingUp className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-700">{stats.contrario}</div>
          <p className="text-xs text-red-600">
            {totalVotes > 0 ? `${((parseInt(stats.contrario) / totalVotes) * 100).toFixed(1)}%` : '0%'} dei voti
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-yellow-800">Indecisi</CardTitle>
          <TrendingUp className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-700">{stats.indeciso}</div>
          <p className="text-xs text-yellow-600">
            {totalVotes > 0 ? `${((parseInt(stats.indeciso) / totalVotes) * 100).toFixed(1)}%` : '0%'} dei voti
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-800">Totale Utenti</CardTitle>
          <Users className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">{totaleUtenti}</div>
          <p className="text-xs text-blue-600">
            {totalVotes} hanno votato
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
