import React from "react";
import { Redirect, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import SondaggiContent from "@/components/SondaggiContent";

export default function SondaggiRegione() {
  const { regione } = useParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  // Controllo più flessibile per l'accesso ai sondaggi
  const userRole = user.role || user.ruolo;
  const hasAdvancedAccess = userRole === "Politico" || userRole === "Candidato" || userRole === "Candidato Politico" || userRole === "Admin";
  if (!hasAdvancedAccess) return <Redirect to="/menu" />;

  return <SondaggiContent filterPath={regione} />;
}
