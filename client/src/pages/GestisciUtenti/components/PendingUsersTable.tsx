import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { User } from "../types";

interface PendingUsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  isProcessing?: boolean;
}

export const PendingUsersTable: React.FC<PendingUsersTableProps> = ({
  users,
  onApprove,
  onReject,
  isProcessing = false
}) => {
  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-lg font-medium text-gray-900 mb-2">Nessun utente in attesa</div>
        <p className="text-gray-500">Tutti gli utenti sono stati processati</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="font-medium text-gray-700">Nome Completo</TableHead>
            <TableHead className="font-medium text-gray-700">Email</TableHead>
            <TableHead className="font-medium text-gray-700">Ruolo</TableHead>
            <TableHead className="text-center font-medium text-gray-700">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-gray-50">
              <TableCell className="font-medium">
                {user.nome_completo || `${user.nome || ''} ${user.cognome || ''}`.trim() || 'N/A'}
              </TableCell>
              <TableCell className="text-gray-600">
                {user.email || 'N/A'}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.ruolo === "AD" 
                    ? 'bg-green-100 text-green-800' 
                    : user.ruolo === "P" 
                    ? 'bg-red-100 text-red-800'
                    : user.ruolo === "C"
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.ruolo || 'N/A'}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex space-x-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onApprove(user)}
                    disabled={isProcessing}
                    className="hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approva
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onReject(user)}
                    disabled={isProcessing}
                    className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Rifiuta
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
