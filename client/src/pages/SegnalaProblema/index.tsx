import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/PageContainer";
import { ReportForm } from "./components/ReportForm";
import { Header } from "./components/Header";

export default function SegnalaProblema() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer className="bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per segnalare un problema.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = '/auth'}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-orange-50 via-white to-yellow-50">
      <div className="container mx-auto px-4 py-8 h-full flex flex-col">
        <Header />

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <ReportForm user={user} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
