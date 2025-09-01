import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Vote, Edit, Trash2 } from "lucide-react";
import { Elezione } from "../types";
import { lineClampStyles } from "../styles";

interface ElezioniListProps {
  elezioni: Elezione[];
  loading: boolean;
  onEdit: (elezione: Elezione) => void;
  onDelete: (id: string) => void;
}

export const ElezioniList: React.FC<ElezioniListProps> = ({ elezioni, loading, onEdit, onDelete }) => {
  if (loading) {
    return (
      <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-lg text-gray-600">Caricamento elezioni...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (elezioni.length === 0) {
    return (
      <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-8">
          <div className="text-center py-12">
            <Vote className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna elezione trovata</h3>
            <p className="text-gray-500">Crea la tua prima elezione per iniziare</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-2xl text-gray-800">
          <Calendar className="h-6 w-6 mr-3 text-blue-600" />
          Lista Elezioni
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {elezioni.map((elezione) => (
                <TableRow key={elezione.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {elezione.tipo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div style={lineClampStyles.lineClamp2} className="max-w-xs">
                      {elezione.zona}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{elezione.datainizio} - {elezione.datafine}</div>
                      {elezione.circa && (
                        <div className="text-gray-500 text-xs">Data approssimativa</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      elezione.circa 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {elezione.circa ? 'Approssimativa' : 'Definitiva'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
