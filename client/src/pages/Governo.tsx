import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Building2, User, Users, Scale, Shield, Banknote, Briefcase, GraduationCap, Heart, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Governo() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const ministeri = [
    {
      title: "Primo Ministro",
      icon: User,
      description: "Presidenza del Consiglio dei Ministri",
      color: "bg-red-100 text-red-600",
      status: "Attivo"
    },
    {
      title: "Ministero degli Esteri",
      icon: Building2,
      description: "Relazioni internazionali e cooperazione",
      color: "bg-blue-100 text-blue-600",
      status: "Attivo"
    },
    {
      title: "Ministero dell'Interno",
      icon: Shield,
      description: "Sicurezza pubblica e amministrazione territoriale",
      color: "bg-green-100 text-green-600",
      status: "Attivo"
    },
    {
      title: "Ministero della Giustizia",
      icon: Scale,
      description: "Sistema giudiziario e carcerario",
      color: "bg-purple-100 text-purple-600",
      status: "Attivo"
    },
    {
      title: "Ministero della Difesa",
      icon: Shield,
      description: "Forze armate e sicurezza nazionale",
      color: "bg-gray-100 text-gray-600",
      status: "Attivo"
    },
    {
      title: "Ministero dell'Economia e delle Finanze",
      icon: Banknote,
      description: "Politiche economiche e fiscali",
      color: "bg-yellow-100 text-yellow-600",
      status: "Attivo"
    },
    {
      title: "Ministero del Lavoro e delle Politiche Sociali",
      icon: Briefcase,
      description: "Occupazione e previdenza sociale",
      color: "bg-orange-100 text-orange-600",
      status: "Attivo"
    },
    {
      title: "Ministero dell'Istruzione",
      icon: GraduationCap,
      description: "Sistema educativo e formazione",
      color: "bg-indigo-100 text-indigo-600",
      status: "Attivo"
    },
    {
      title: "Ministero della Salute",
      icon: Heart,
      description: "Sanità pubblica e politiche sanitarie",
      color: "bg-pink-100 text-pink-600",
      status: "Attivo"
    },
    {
      title: "Ministero della Cultura",
      icon: Palette,
      description: "Patrimonio culturale e spettacolo",
      color: "bg-teal-100 text-teal-600",
      status: "Attivo"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-7xl">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center"
          onClick={() => window.location.href = "/menu"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
        </Button>
        
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full">
                <Building2 className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Governo
            </CardTitle>
            <CardDescription className="text-lg">
              Gestione dei ministeri e delle politiche governative
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {ministeri.map((ministero, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-3 rounded-lg ${ministero.color}`}>
                    <ministero.icon className="h-6 w-6" />
                  </div>
                  <Badge variant={ministero.status === "Attivo" ? "default" : "secondary"}>
                    {ministero.status}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight">
                  {ministero.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {ministero.description}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Personale:</span>
                    <span className="font-medium">---</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Budget:</span>
                    <span className="font-medium">---</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Statistiche Generali */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Ministri Attivi</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">10</div>
              <p className="text-sm text-muted-foreground">Su 10 ministeri</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5" />
                <span>Progetti in Corso</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">---</div>
              <p className="text-sm text-muted-foreground">Iniziative attive</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Scale className="h-5 w-5" />
                <span>Leggi Approvate</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">---</div>
              <p className="text-sm text-muted-foreground">Nell'ultimo anno</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}