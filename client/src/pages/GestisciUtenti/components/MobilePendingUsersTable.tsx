import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, User, Mail, Calendar, Clock } from "lucide-react";
import { User as UserType } from "../types";
import { formatColumnValue } from "../utils/columnUtils";

interface MobilePendingUsersTableProps {
  users: UserType[];
  onApprove: (user: UserType) => void;
  onReject: (user: UserType) => void;
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
        <Card key={user.id} className="w-full shadow-sm border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            {/* Header con nome e badge */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900 truncate">
                    {user.nome_completo || `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'}
                  </h3>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <Clock className="h-3 w-3 mr-1" />
                    In Attesa
                  </Badge>
                </div>
              </div>
            </div>

            {/* Informazioni principali */}
            <div className="space-y-2 mb-4">
              {/* Email */}
              {user.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600 truncate">{user.email}</span>
                </div>
              )}

              {/* Data registrazione */}
              {user.created_at && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600">
                    Registrato: {formatColumnValue(user.created_at, 'created_at')}
                  </span>
                </div>
              )}


              {/* Telefono */}
              {user.telefono && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Tel:</span> {user.telefono}
                </div>
              )}
            </div>

            {/* Azioni */}
            <div className="flex space-x-2 pt-3 border-t border-yellow-200">
              <Button 
                onClick={() => onApprove(user)}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approva
              </Button>
              <Button 
                onClick={() => onReject(user)}
                disabled={isProcessing}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                size="sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rifiuta
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
