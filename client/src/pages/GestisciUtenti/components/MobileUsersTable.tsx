import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, User, Mail, Calendar } from "lucide-react";
import { User as UserType } from "../types";
import { formatColumnValue } from "../utils/columnUtils";
import { EditableDropdown } from "./EditableDropdown";

interface MobileUsersTableProps {
  users: UserType[];
  onEdit: (user: UserType) => void;
  onEditOpinioni: (user: UserType) => void;
  onDelete: (user: UserType) => void;
  userChanges?: Record<string, { grado_elezione?: string | null; grado_candidatura?: string | null }>;
  onFieldChange?: (userId: string, field: 'grado_elezione' | 'grado_candidatura', value: string | null) => void;
}

export const MobileUsersTable: React.FC<MobileUsersTableProps> = ({
  users,
  onEdit,
  onEditOpinioni,
  onDelete,
  userChanges = {},
  onFieldChange
}) => {
  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</div>
        <p className="text-gray-500">Prova a modificare i criteri di ricerca</p>
      </div>
    );
  }

  const getStatusBadge = (user: UserType) => {
    const status = user.status || user.stato;
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Attivo</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Attesa</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Inattivo</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const getRoleBadge = (user: UserType) => {
    const role = user.ruolo || user.role;
    switch (role) {
      case 'Admin':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Admin</Badge>;
      case 'User':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Utente</Badge>;
      default:
        return <Badge variant="outline">{role || 'N/A'}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <Card key={user.id} className="w-full shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            {/* Header con nome e azioni */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900 truncate">
                    {user.nome_completo || `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'}
                  </h3>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  {getStatusBadge(user)}
                  {getRoleBadge(user)}
                </div>
              </div>
              
              {/* Azioni */}
              <div className="flex space-x-1 ml-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(user)}
                  className="p-2 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEditOpinioni(user)}
                  className="p-2 hover:bg-green-50"
                >
                  📝
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(user)}
                  className="p-2 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Informazioni principali */}
            <div className="space-y-2">
              {/* Email */}
              {user.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600 truncate">{user.email}</span>
                </div>
              )}

              {/* Data creazione */}
              {user.created_at && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600">
                    {formatColumnValue(user.created_at, 'created_at')}
                  </span>
                </div>
              )}

              {/* Grado Elezione */}
              {(user.grado_elezione || userChanges[user.id]?.grado_elezione !== undefined) && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Grado Elezione:</label>
                  <EditableDropdown
                    value={userChanges[user.id]?.grado_elezione !== undefined ? userChanges[user.id].grado_elezione : user.grado_elezione}
                    onChange={(value) => onFieldChange?.(user.id, 'grado_elezione', value)}
                    options={['Europeo', 'Nazionale', 'Camera', 'Senato', 'Regionale', 'Comunale']}
                    placeholder="Seleziona..."
                    className="w-full text-sm"
                  />
                </div>
              )}

              {/* Grado Candidatura */}
              {(user.grado_candidatura || userChanges[user.id]?.grado_candidatura !== undefined) && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Grado Candidatura:</label>
                  <EditableDropdown
                    value={userChanges[user.id]?.grado_candidatura !== undefined ? userChanges[user.id].grado_candidatura : user.grado_candidatura}
                    onChange={(value) => onFieldChange?.(user.id, 'grado_candidatura', value)}
                    options={['Europeo', 'Nazionale', 'Camera', 'Senato', 'Regionale', 'Comunale']}
                    placeholder="Seleziona..."
                    className="w-full text-sm"
                  />
                </div>
              )}

              {/* Altre informazioni importanti */}
              {user.codice_fiscale && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">CF:</span> {user.codice_fiscale}
                </div>
              )}

              {user.telefono && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Tel:</span> {user.telefono}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
