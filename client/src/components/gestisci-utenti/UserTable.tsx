import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { UserTableProps } from "./types";
import { formatColumnValue, renderColumnValue } from "./utils";

export function UserTable({ 
  users, 
  displayColumns, 
  onEditUser, 
  onEditOpinioni, 
  onDeleteUser, 
  sortField, 
  sortDirection, 
  onSort 
}: UserTableProps) {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 text-gray-400 mx-auto mb-4">👥</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</h3>
        <p className="text-gray-500">Prova a modificare i criteri di ricerca</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {displayColumns.map((column) => (
              <TableHead key={column} className="cursor-pointer hover:bg-gray-50" onClick={() => onSort(column as any)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {column === 'nome_completo' ? 'Nome Completo' :
                     column === 'status_candidatura' ? 'Status Candidatura' :
                     column === 'grado_candidatura' ? 'Grado Candidatura' :
                     column === 'grado_elezione' ? 'Grado Elezione' :
                     column === 'paese_candidatura' ? 'Paese Candidatura' :
                     column === 'regione_candidatura' ? 'Regione Candidatura' :
                     column === 'provincia_candidatura' ? 'Provincia Candidatura' :
                     column === 'comune_candidatura' ? 'Comune Candidatura' :
                     column === 'data_candidatura' ? 'Data Candidatura' :
                     column === 'note_candidatura' ? 'Note Candidatura' :
                     column === 'paese_elezione' ? 'Paese Elezione' :
                     column === 'regione_elezione' ? 'Regione Elezione' :
                     column === 'provincia_elezione' ? 'Provincia Elezione' :
                     column === 'comune_elezione' ? 'Comune Elezione' :
                     column === 'candidato_attivo' ? 'Candidato Attivo' :
                     column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, ' ')}
                  </span>
                  {sortField === column && (
                    <span className="text-blue-600 ml-2">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-gray-50">
              {displayColumns.map((column) => (
                <TableCell key={column} className="max-w-[200px]">
                  <div className="truncate" title={formatColumnValue(user[column], column)}>
                    {renderColumnValue(user[column], column, user)}
                  </div>
                </TableCell>
              ))}
              <TableCell className="text-center">
                <div className="flex space-x-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEditUser(user)}
                    className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifica
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEditOpinioni(user)}
                    className="hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                  >
                    📝 Opinioni
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDeleteUser(user)}
                    className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
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
  );
}
