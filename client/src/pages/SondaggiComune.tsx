import React from "react";
import { Redirect, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import SondaggiContent from "@/components/SondaggiContent";

export default function SondaggiComune() {
  const { regione, provincia, comune } = useParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  // Controllo più flessibile per l'accesso ai sondaggi
  const userRole = user.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD";
  if (!hasAdvancedAccess) return <Redirect to="/menu" />;

  return <SondaggiContent filterPath={`${regione}/${provincia}/${comune}`} />;
}
