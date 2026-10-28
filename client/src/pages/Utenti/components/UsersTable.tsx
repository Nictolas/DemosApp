import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { User, SortState } from "../types";
import { formatColumnValue } from "../utils/columnUtils";
import { renderColumnValue } from "../utils/renderUtils";

interface UsersTableProps {
  users: User[];
  displayColumns: string[];
  sortState: SortState;
  onSort: (field: keyof User) => void;
  onEdit: (user: User) => void;
  onEditOpinioni: (user: User) => void;
  onDelete: (user: User) => void;
  onEditAvatar?: (user: User) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  displayColumns,
  sortState,
  onSort,
  onEdit,
  onEditOpinioni,
  onDelete,
  onEditAvatar
}) => {
  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</div>
        <p className="text-gray-500">Prova a modificare i criteri di ricerca</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            {displayColumns.map((column) => (
              <TableHead 
                key={column} 
                className={column === 'avatar' ? "text-center" : "cursor-pointer hover:bg-gray-50"} 
                onClick={column === 'avatar' ? undefined : () => onSort(column as keyof User)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 capitalize">
                    {column === 'sesso' ? 'Sesso anagrafico (CIE)' : column.replace(/_/g, ' ')}
                  </span>
                  {column !== 'avatar' && sortState.sortField === column && (
                    <span className="text-blue-600 ml-2">
                      {sortState.sortDirection === 'asc' ? '↑' : '↓'}
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
                <TableCell 
                  key={column} 
                  className={column === 'avatar' ? "text-center w-16" : "min-w-[150px] max-w-[300px]"}
                >
                  <div className={column === 'avatar' ? "" : "truncate"} title={formatColumnValue(user[column], column, user)}>
                    {renderColumnValue(user[column], column, user, onEditAvatar)}
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
                    onClick={() => onEditOpinioni(user)}
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
  );
};
