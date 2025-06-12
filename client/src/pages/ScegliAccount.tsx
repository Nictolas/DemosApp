import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Vote, Users, Star, CheckCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";

interface AccountType {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  color: string;
  icon: React.ReactNode;
  popular?: boolean;
  free?: boolean;
}

const accountTypes: AccountType[] = [
  {
    id: "voter",
    name: "Demos Voter",
    price: "Gratuito",
    period: "per sempre",
    description: "Per chi: Gli elettori e i cittadini che vogliono interagire con la politica",
    features: [
      "Esprimere le proprie opinioni su temi importanti",
      "Trovare rappresentanti e candidati con ideologie compatibili", 
      "Votare simbolicamente per capo di stato, amnistia, grazia e governo ideale",
      "Ricevere aggiornamenti costanti sulle votazioni e attività dei rappresentanti"
    ],
    color: "blue",
    icon: <Vote className="h-6 w-6" />,
    free: true
  },
  {
    id: "candidate", 
    name: "Demos Candidate",
    price: "30 €",
    period: "all'anno",
    description: "Per chi: I candidati che aspirano a una carica politica",
    features: [
      "Creare e gestire il proprio profilo pubblico di candidato",
      "Interagire con gli elettori e costruire una base di sostenitori",
      "Accesso a strumenti base per l'engagement e l'analisi",
      "In caso di vittoria: passaggio a Demos Rep gratuito per il primo anno!"
    ],
    color: "green",
    icon: <Users className="h-6 w-6" />
  },
  {
    id: "rep",
    name: "Demos Rep", 
    price: "50 €",
    period: "all'anno",
    description: "Per chi: I rappresentanti eletti e i politici in carica",
    features: [
      "Badge Verificato: Riconoscimento ufficiale del ruolo istituzionale",
      "Dashboard Elettorale: Analisi e report delle preferenze in tempo reale", 
      "Canale Diretto: Notifiche push e comunicazioni personalizzate",
      "Strumenti di Engagement: Statistiche e sondaggi avanzati",
      "Gestione avanzata del profilo e delle comunicazioni"
    ],
    color: "purple",
    icon: <Crown className="h-6 w-6" />,
    popular: true
  },
  {
    id: "plus",
    name: "Demos Plus",
    price: "69 €", 
    period: "all'anno",
    description: "Per chi: Politici già eletti che si preparano alle prossime elezioni",
    features: [
      "Include tutte le funzionalità di Demos Candidate e Demos Rep",
      "Accesso prioritario a nuove funzionalità e supporto dedicato",
      "Strumenti avanzati di analisi e strategia elettorale",
      "Massima visibilità e coinvolgimento con l'elettorato"
    ],
    color: "orange",
    icon: <Star className="h-6 w-6" />
  }
];

export default function ScegliAccount() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAccountSelection = async (accountTypeId: string) => {
    setSelectedAccount(accountTypeId);
    setIsProcessing(true);

    try {
      // Store the selected account type in localStorage for the registration process
      localStorage.setItem('selectedAccountType', accountTypeId);
      
      // Navigate to appropriate registration flow based on account type
      if (accountTypeId === 'voter') {
        setLocation('/registrazione');
      } else if (accountTypeId === 'candidate') {
        setLocation('/registrazione-candidatura');
      } else if (accountTypeId === 'rep') {
        setLocation('/registrazione-elezione');
      } else if (accountTypeId === 'plus') {
        setLocation('/registrazione-elezione-candidatura');
      }
    } catch (error) {
      console.error('Error selecting account type:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: "border-blue-500 bg-blue-50",
      green: "border-green-500 bg-green-50", 
      purple: "border-purple-500 bg-purple-50",
      orange: "border-orange-500 bg-orange-50"
    };
    return colorMap[color as keyof typeof colorMap] || "border-gray-500 bg-gray-50";
  };

  const getIconColor = (color: string) => {
    const colorMap = {
      blue: "text-blue-500",
      green: "text-green-500",
      purple: "text-purple-500", 
      orange: "text-orange-500"
    };
    return colorMap[color as keyof typeof colorMap] || "text-gray-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      <div className="container mx-auto p-4 max-w-7xl">
        
        {/* Header */}
        <Card className="mt-6 mb-8">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Scegli il Tuo Account DEMOS
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              Durante la fase di registrazione, seleziona il tipo di account più adatto alle tue esigenze politiche
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Account Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {accountTypes.map((account) => (
            <Card 
              key={account.id}
              className={`relative cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                selectedAccount === account.id ? 'ring-2 ring-primary' : ''
              } ${account.popular ? 'border-2 border-primary' : ''}`}
              onClick={() => handleAccountSelection(account.id)}
            >
              {account.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-white">
                  Più Popolare
                </Badge>
              )}
              
              <CardHeader className={`pb-4 ${getColorClasses(account.color)}`}>
                <div className="flex items-center justify-center mb-2">
                  <div className={`p-3 rounded-full bg-white ${getIconColor(account.color)}`}>
                    {account.icon}
                  </div>
                </div>
                <CardTitle className="text-xl text-center">{account.name}</CardTitle>
                <div className="text-center">
                  <span className="text-2xl font-bold">{account.price}</span>
                  {!account.free && <span className="text-sm text-muted-foreground">/{account.period}</span>}
                </div>
              </CardHeader>
              
              <CardContent className="pt-4">
                <CardDescription className="text-sm mb-4 font-medium">
                  {account.description}
                </CardDescription>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Poteri:</h4>
                  <ul className="space-y-1">
                    {account.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Button 
                  className="w-full mt-4"
                  variant={selectedAccount === account.id ? "default" : "outline"}
                  disabled={isProcessing}
                >
                  {isProcessing && selectedAccount === account.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Seleziona
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Note Importanti</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Transizioni Automatiche</h4>
                  <p>Se vinci delle elezioni con un account "Demos Candidate", passi automaticamente a "Demos Rep" gratuito per il primo anno!</p>
                </div>
                <div className="bg-white/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Account Admin</h4>
                  <p>Gli account "Demos Admin" sono riservati agli amministratori della piattaforma e non sono disponibili per la registrazione pubblica.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}