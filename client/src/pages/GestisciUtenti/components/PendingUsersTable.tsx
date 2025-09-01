import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle } from 'lucide-react';
import { User } from '../types';
import { renderColumnValue, formatColumnValue } from '../utils';

interface PendingUsersTableProps {
  pendingUsers: User[];
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  isApprovalPending: boolean;
}

export const PendingUsersTable: React.FC<PendingUsersTableProps> = ({
  pendingUsers,
  onApprove,
  onReject,
  isApprovalPending
}) => {
  return (
    <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg mb-8">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-2xl text-gray-800">
          <AlertCircle className="h-6 w-6 mr-3 text-yellow-600" />
          Utenti in Attesa
        </CardTitle>
        <CardDescription className="text-gray-600">
          Visualizza e gestisci gli utenti che attendono l'approvazione
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Nome Completo</TableHead>
                  <TableHead className="text-left">Email</TableHead>
                  <TableHead className="text-left">Ruolo</TableHead>
                  <TableHead className="text-left">Genere</TableHead>
                  <TableHead className="text-left">Data Creazione</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((pendingUser) => (
                  <TableRow key={pendingUser.id} className="hover:bg-gray-50">
                    <TableCell className="max-w-[200px]">
                      <div className="truncate">
                        <Link 
                          href={`/menu/profilo/${pendingUser.id}?from=utenti`} 
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                        >
                          {pendingUser.nome} {pendingUser.cognome}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate">{pendingUser.email}</div>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {renderColumnValue(pendingUser.ruolo, 'ruolo', pendingUser)}
                    </TableCell>
                    <TableCell className="max-w-[100px]">
                      {renderColumnValue(pendingUser.genere, 'genere', pendingUser)}
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <div className="truncate">
                        {formatColumnValue(pendingUser.created_at, 'created_at')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex space-x-2 justify-center">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" 
                          onClick={() => onReject(pendingUser.id)} 
                          disabled={isApprovalPending}
                        >
                          Rifiuta
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-green-500 hover:bg-green-600" 
                          onClick={() => onApprove(pendingUser.id)} 
                          disabled={isApprovalPending}
                        >
                          Approva
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente in attesa</h3>
            <p className="text-gray-500">Tutti gli utenti sono stati approvati</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
