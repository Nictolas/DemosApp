import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  AccessControl, 
  NavigationButtons, 
  LastCommunication,
  type LastCommunication as LastCommunicationType
} from "@/components/comunica";

export default function Comunica() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Get user's last communication
  const { data: ultimaComunicazione } = useQuery({
    queryKey: ["/api/ultima-comunicazione", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", `/api/comunicazioni/ultima-comunicazione?user_id=${user.id}`);
      if (!response.ok) {
        if (response.status === 404) return null; // No previous communication
        throw new Error('Failed to fetch last communication');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Show loading while user data is being fetched
  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Caricamento dati utente...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  return (
    <AccessControl user={user}>
      <div className="min-h-screen bg-linear-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setLocation("/menu")}
              className="flex items-center gap-2"
            >
              Torna al Menu
            </Button>
          </div>

          {/* Titolo */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                Strumenti
              </CardTitle>
              <CardDescription>
                Accedi agli strumenti di gestione, comunicazione e analisi
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Pulsanti Navigazione */}
          <NavigationButtons user={user} onNavigate={handleNavigate} />

          {/* Ultima Votazione Section */}
          <LastCommunication communication={ultimaComunicazione} />
        </div>
      </div>
    </AccessControl>
  );
}
