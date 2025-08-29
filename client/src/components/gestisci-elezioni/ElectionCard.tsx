import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Vote, MapPin, Clock, Target } from "lucide-react";
import { ElectionCardProps } from "./types";
import { formatDate } from "./electionsUtils";

export function ElectionCard({ elezione, onEdit, onDelete }: ElectionCardProps) {
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-blue-100">
      <CardContent className="p-6">
        {/* Header con status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 capitalize">{elezione.tipo}</h3>
            <p className="text-sm text-gray-600">{elezione.zona}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            elezione.circa 
              ? 'bg-orange-100 text-orange-800 border border-orange-200' 
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {elezione.circa ? 'Circa' : 'Esatta'}
          </span>
        </div>
        
        {/* Dettagli elezione */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center space-x-2">
            <Vote className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-gray-600 capitalize">{elezione.tipo}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-sm text-gray-600">{elezione.zona}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-gray-600">
              {elezione.datainizio} - {elezione.datafine}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Target className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-gray-600">
              Creata: {formatDate(elezione.createdAt)}
            </span>
          </div>
        </div>
        
        {/* Azioni */}
        <div className="flex space-x-2 pt-3 border-t border-gray-100">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(elezione)}
            className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Modifica
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDelete(elezione.id)}
            className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Elimina
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
