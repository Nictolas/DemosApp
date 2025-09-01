import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Edit, Trash2 } from 'lucide-react';
import { User, SortField, SortDirection } from '../types';
import { renderColumnValue, formatColumnValue, getColumnDisplayName } from '../utils';

interface UsersTableProps {
  users: User[];
  displayColumns: string[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onEdit: (user: User) => void;
  onEditOpinions: (user: User) => void;
  onDelete: (user: User) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  displayColumns,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onEditOpinions,
  onDelete,
  currentPage,
  totalPages,
  onPageChange
}) => {
  return (
    <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-2xl text-gray-800">
          <Users className="h-6 w-6 mr-3 text-blue-600" />
          Utenti Attivi
        </CardTitle>
        <CardDescription className="text-gray-600">
          Visualizza e gestisci tutti gli utenti della piattaforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayColumns.map((column) => (
                      <TableHead 
                        key={column}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => onSort(column as SortField)}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="capitalize">
                            {getColumnDisplayName(column)}
                          </span>
                          {sortField === column && (
                            <span className="text-blue-600">
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
                            onClick={() => onEdit(user)}
                            className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Modifica
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => onEditOpinions(user)}
                            className="hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                          >
                            📝 Opinioni
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => onDelete(user)}
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

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-8">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))} 
                  disabled={currentPage === 1}
                  className="px-4 py-2"
                >
                  ← Precedente
                </Button>
                <div className="flex items-center space-x-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      size="sm"
                      variant={currentPage === page ? "default" : "outline"}
                      onClick={() => onPageChange(page)}
                      className="w-10 h-10"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} 
                  disabled={currentPage === totalPages}
                  className="px-4 py-2"
                >
                  Successiva →
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</h3>
            <p className="text-gray-500">Prova a modificare i criteri di ricerca</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
