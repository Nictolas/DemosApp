import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { User } from "../types";

interface MobilePendingUsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  isProcessing: boolean;
}

export const MobilePendingUsersTable: React.FC<MobilePendingUsersTableProps> = ({
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
    <div className="space-y-4">
      {users.map((user) => (
        <Card key={user.id} className="p-4">
          <CardContent className="p-0">
            <div className="mb-3">
              <h3 className="font-semibold text-lg text-gray-900">
                {user.nome_completo || `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'}
              </h3>
              <p className="text-sm text-gray-600">{user.email}</p>
              <p className="text-sm text-gray-500">{user.ruolo}</p>
              <p className="text-xs text-gray-400">
                Registrato: {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : 'N/A'}
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => onApprove(user)}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-1" />
                Approva
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReject(user)}
                disabled={isProcessing}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />
                Rifiuta
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
