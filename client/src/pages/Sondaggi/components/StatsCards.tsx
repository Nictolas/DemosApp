import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users } from "lucide-react";
import { SondaggiData } from "../types";

interface StatsCardsProps {
  sondaggiData: SondaggiData;
  totalVotes: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  sondaggiData,
  totalVotes
}) => {
  const { questions = [], utentiUnici = 0 } = sondaggiData;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Domande Totali</p>
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Voti Totali</p>
              <p className="text-2xl font-bold text-gray-900">{totalVotes}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Utenti Totali</p>
              <p className="text-2xl font-bold text-gray-900">{utentiUnici}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
