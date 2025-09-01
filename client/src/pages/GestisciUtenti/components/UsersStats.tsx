import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, AlertCircle, Shield } from 'lucide-react';
import { User } from '../types';

interface UsersStatsProps {
  utenti: User[];
  pendingUsers: User[];
}

export const UsersStats: React.FC<UsersStatsProps> = ({ utenti, pendingUsers }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Utenti Totali</p>
              <p className="text-2xl font-bold text-blue-900">{utenti.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Utenti Attivi</p>
              <p className="text-2xl font-bold text-green-900">
                {utenti.filter(u => u.status === 'active').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500 rounded-lg">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-600">In Attesa</p>
              <p className="text-2xl font-bold text-yellow-900">{pendingUsers.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Admin</p>
              <p className="text-2xl font-bold text-purple-900">
                {utenti.filter(u => u.ruolo === 'Admin').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
