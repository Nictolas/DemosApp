import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/PageContainer";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft, FileSignature, AlertCircle, RefreshCw } from "lucide-react";

interface ECIItem {
  id: string;
  title: string;
  firme: number;
  signature_count?: number;
  slug?: string;
}

interface ECIDataResponse {
  success: boolean;
  source?: string;
  initiatives: ECIItem[];
}

export default function ECI() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  const {
    data: eciData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<ECIDataResponse>({
    queryKey: ["eci", "initiatives"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/eci");
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || response?.data?.message || "Errore nel caricamento delle ECI");
      }
      const result = response.data;
      if (result && !result.success && result.success !== undefined) {
        throw new Error(result.error || result.message || "Errore nel caricamento delle ECI");
      }
      return { ...result, success: true, initiatives: result.initiatives || [] };
    },
    enabled: !!user,
    retry: 1,
  });

  const list: ECIItem[] = (eciData?.initiatives || []).map((item: any) => ({
    id: item.id,
    title: item.title || "Senza titolo",
    firme: item.firme ?? item.signature_count ?? 0,
    slug: item.slug,
  })).sort((a, b) => b.firme - a.firme);

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="bg-gradient-to-br from-teal-50 to-white">
      <div className="w-full px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/gestisci")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileSignature className="h-8 w-8 text-teal-600" />
                ECI
              </h1>
              <p className="text-muted-foreground mt-1">
                Iniziative dei Cittadini Europei (ICE) e numero di firme
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aggiorna
          </Button>
        </div>

        {/* Error */}
        {isError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : "Errore nel caricamento delle ECI."}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="ml-4 text-muted-foreground">Caricamento lista ECI (Decidim GraphQL)...</p>
            </CardContent>
          </Card>
        )}

        {/* Lista ECI e firme (da Decidim GraphQL) */}
        {!isLoading && !isError && (
          <Card>
            <CardHeader>
              <CardTitle>Lista ECI e numero di firme</CardTitle>
              <p className="text-sm text-muted-foreground">
                Iniziative dei Cittadini Europei (ECI) da Decidim, ordinate per numero di firme.
                {eciData?.source === "decidim_graphql" && " Fonte: API GraphQL Decidim."}
                {eciData?.source === "eci_table" && " Fonte: cache (tabella ECI)."}
              </p>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nessuna ECI disponibile. Configura DECIDIM_GRAPHQL_URL o popola la tabella ECI.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Iniziativa (ECI)</th>
                        <th className="text-right p-3 font-medium">N° firme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <span className="font-medium">{item.title}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-semibold text-teal-600">
                              {item.firme.toLocaleString("it-IT")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
