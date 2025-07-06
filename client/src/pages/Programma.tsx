import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export default function Programma() {
  const { user } = useAuth();
  const { data: userData } = useQuery({
    queryKey: ["/api/users", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user?.email,
  });

  if (userData && !['Admin', 'Candidato', 'Candidato Politico'].includes(userData.ruolo)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 flex items-center justify-center">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Accesso negato</CardTitle>
            <CardDescription>
              Non hai i permessi per visualizzare questa pagina.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              Programma
            </CardTitle>
            <CardDescription>
              Qui potrai visualizzare o modificare il programma (prossimamente).
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
} 