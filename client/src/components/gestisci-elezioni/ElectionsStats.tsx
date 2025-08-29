import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Vote, Calendar, Target, Users } from "lucide-react";
import { ElectionsStatsProps } from "./types";
import { calculateElectionStats } from "./electionsUtils";

export function ElectionsStats({ elezioni }: ElectionsStatsProps) {
  const stats = calculateElectionStats(elezioni);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Vote className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Totale Elezioni</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Sovranazione</p>
              <p className="text-2xl font-bold text-green-900">{stats.sovranazione}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Stato</p>
              <p className="text-2xl font-bold text-purple-900">{stats.stato}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-orange-600">Regione</p>
              <p className="text-2xl font-bold text-orange-900">{stats.regione}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
