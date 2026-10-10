import React, { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { RefreshCw, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "./components/Header";
import { ICETable } from "./components/ICETable";
import { useICEData } from "./hooks/useICEData";

export default function ICE() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { listaICE, isLoading, isError, refetch } = useICEData(Boolean(user));

  const filteredICE = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("it-IT");
    if (!query) return listaICE;
    return listaICE.filter((ice) =>
      `${ice.nome} ${ice.descrizione || ""}`.toLocaleLowerCase("it-IT").includes(query),
    );
  }, [listaICE, searchQuery]);

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="container mx-auto px-4 py-8 page-with-navbar">
      <Card className="w-full rounded-2xl shadow-lg bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <Header />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
          </div>

          <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            DEMOS mostra le Iniziative dei Cittadini Europei attualmente in raccolta firme dalla fonte ufficiale UE.
            Non esistono voti o classifiche DEMOS sulle ICE: per sostenere un'iniziativa usa il relativo portale ufficiale.
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cerca tra le ICE ufficiali..."
              className="pl-10"
            />
          </div>

          <ICETable listaICE={filteredICE} isLoading={isLoading} isError={isError} />
        </CardContent>
      </Card>
    </div>
  );
}
