import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar } from "lucide-react";
import { User as UserType } from "../types";
import { formatColumnValue } from "../utils/columnUtils";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

interface MobileUsersTableProps {
  users: UserType[];
}

export const MobileUsersTable: React.FC<MobileUsersTableProps> = ({
  users
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
            {/* Header del profilo in sola consultazione */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-1">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {user.avatar_config ? (
                      (() => {
                        try {
                          // Gestisci il caso di doppia serializzazione JSON
                          let config;
                          if (typeof user.avatar_config === 'string') {
                            // Prima prova a fare il parse diretto
                            config = JSON.parse(user.avatar_config);
                            // Se il risultato è ancora una stringa, fai un secondo parse
                            if (typeof config === 'string') {
                              config = JSON.parse(config);
                            }
                          } else {
                            config = user.avatar_config;
                          }
                          return <CustomAvatar config={config} size={32} className="w-8 h-8" />;
                        } catch (e) {
                          console.log(`⚠️ DEBUG MobileUsersTable - Errore parsing avatar per ${user.id}:`, e);
                          return <User className="h-8 w-8 text-gray-400" />;
                        }
                      })()
                    ) : (
                      <User className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-gray-900 truncate">
                      {user.nome_completo || `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusBadge(user)}
                      {getRoleBadge(user)}
                    </div>
                  </div>
                </div>
                
                {/* Email */}
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{user.email}</span>
                </div>
                
                {/* Data registrazione */}
                {user.created_at && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>Registrato: {new Date(user.created_at).toLocaleDateString('it-IT')}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Gradi elettorali: visualizzati senza controlli di modifica. */}
            {(user.grado_elezione || user.grado_candidatura) && (
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                {user.grado_elezione && (
                  <div>
                    <span className="block text-xs text-gray-500">Grado Elezione</span>
                    <span>{user.grado_elezione}</span>
                  </div>
                )}
                {user.grado_candidatura && (
                  <div>
                    <span className="block text-xs text-gray-500">Grado Candidatura</span>
                    <span>{user.grado_candidatura}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};