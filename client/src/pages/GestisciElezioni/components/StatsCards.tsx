import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Vote, MapPin, Clock, Users, Target } from "lucide-react";
import { Elezione } from "../types";

interface StatsCardsProps {
  elezioni: Elezione[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ elezioni }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Totale</p>
              <p className="text-2xl font-bold text-blue-900">{elezioni.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Vote className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Sovranazione</p>
              <p className="text-2xl font-bold text-green-900">{elezioni.filter(e => e.tipo === 'sovranazione').length}</p>
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
              <p className="text-2xl font-bold text-purple-900">{elezioni.filter(e => e.tipo === 'stato').length}</p>
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
              <p className="text-2xl font-bold text-orange-900">{elezioni.filter(e => e.tipo === 'regione').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-600">Provincia</p>
              <p className="text-2xl font-bold text-indigo-900">{elezioni.filter(e => e.tipo === 'provincia').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pink-500 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-pink-600">Comune</p>
              <p className="text-2xl font-bold text-pink-900">{elezioni.filter(e => e.tipo === 'comune').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
