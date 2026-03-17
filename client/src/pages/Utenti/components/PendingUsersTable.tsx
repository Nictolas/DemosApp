import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { User } from "../types";

interface PendingUsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  isProcessing: boolean;
}

export const PendingUsersTable: React.FC<PendingUsersTableProps> = ({
  users,
  onApprove,
  onReject,
  isProcessing
}) => {
  if (users.length === 0) {
    return (
      <div className="text-center py-8">
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
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Ruolo</TableHead>
            <TableHead>Data Registrazione</TableHead>
            <TableHead>Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                {user.nome_completo || `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.ruolo}</TableCell>
              <TableCell>
                {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onApprove(user)}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approva
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onReject(user)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4 mr-1" />
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
