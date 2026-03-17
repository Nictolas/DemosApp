import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart as BarChartIcon, Users } from "lucide-react";
import { StatsOverviewProps } from "./types";

export function StatsOverview({ stats, totaleUtenti, totalVotes }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Totale Utenti</p>
              <p className="text-2xl font-bold text-gray-900">{totaleUtenti}</p>
              <p className="text-xs text-muted-foreground">Utenti registrati</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <BarChartIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Favorevoli</p>
              <p className="text-2xl font-bold text-green-600">{parseInt(stats.favorevole) || 0}</p>
              <p className="text-xs text-muted-foreground">
                {totalVotes > 0 ? Math.round(((parseInt(stats.favorevole) || 0) / totalVotes) * 100) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <BarChartIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Contrari</p>
              <p className="text-2xl font-bold text-red-600">{parseInt(stats.contrario) || 0}</p>
              <p className="text-xs text-muted-foreground">
                {totalVotes > 0 ? Math.round(((parseInt(stats.contrario) || 0) / totalVotes) * 100) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
