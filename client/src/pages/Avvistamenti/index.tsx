import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2, Phone, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/PageContainer";
import { Link } from "wouter";
import { EmergencyDialog } from "./components/EmergencyDialog";

interface EmergencyCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  numbers: Array<{
    number: string;
    label: string;
    description?: string;
  }>;
}

const emergencyCategories: EmergencyCategory[] = [
  {
    id: "animali-feriti",
    title: "Animali feriti (selvatici)",
    description: "Segnala animali selvatici feriti",
    icon: "🐾",
    numbers: [
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  },
  {
    id: "uccelli-feriti",
    title: "Uccelli feriti",
    description: "Segnala uccelli feriti o in difficoltà",
    icon: "🦅",
    numbers: [
      { number: "1515", label: "1515", description: "Carabinieri Forestali" },
      { number: "0521273043", label: "LIPU 0521 273043", description: "Lega Italiana Protezione Uccelli" }
    ]
  },
  {
    id: "animali-pericolosi",
    title: "Lupi/volpi/cinghiali pericolosi",
    description: "Segnala animali pericolosi",
    icon: "🐺",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" },
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  },
  {
    id: "incendi",
    title: "Incendi / fumo sospetto",
    description: "Segnala incendi o fumo sospetto",
    icon: "🔥",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" },
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  },
  {
    id: "frane",
    title: "Frane, alberi pericolanti, smottamenti",
    description: "Segnala pericoli strutturali",
    icon: "⛰️",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" }
    ]
  },
  {
    id: "veicoli-sospetti",
    title: "Veicoli sospetti / ricercati",
    description: "Segnala veicoli sospetti",
    icon: "🚗",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "persona-scomparsa",
    title: "Persona scomparsa / avvistata",
    description: "Segnala persone scomparse o avvistate",
    icon: "👤",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "persona-difficolta",
    title: "Persona in difficoltà",
    description: "Segnala persone in difficoltà",
    icon: "🆘",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "attivita-illegali",
    title: "Attività illegali",
    description: "Segnala attività illegali",
    icon: "🚨",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" },
      { number: "117", label: "117", description: "Guardia di Finanza" }
    ]
  },
  {
    id: "illuminazione",
    title: "Illuminazione pubblica guasta / pericoli stradali",
    description: "Segnala problemi stradali",
    icon: "💡",
    numbers: [
      { number: "1518", label: "1518", description: "Viabilità ANAS" }
    ]
  }
];

export default function Avvistamenti() {
  const { user, isLoading } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <PageContainer className="bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per accedere agli avvistamenti.</CardDescription>
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

  const handleCategoryClick = (category: EmergencyCategory) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  };

  return (
    <PageContainer className="bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="container mx-auto px-4 py-8 h-full flex flex-col">
        {/* Header */}
        <div className="mb-8">
          <Link href="/impostazioni">
            <Button 
              variant="ghost" 
              size="icon"
              className="mb-4 h-12 w-12 rounded-full bg-white border border-white/20 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                Avvistamenti
              </h1>
              <p className="text-gray-600 text-lg font-medium">
                Numeri di emergenza e segnalazioni
              </p>
            </div>
          </div>
        </div>

        {/* Grid delle categorie */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emergencyCategories.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                className="w-full justify-start h-24 rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 group p-4"
                onClick={() => handleCategoryClick(category)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="text-3xl">{category.icon}</div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{category.title}</div>
                    <div className="text-xs text-gray-600">{category.description}</div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Dialog per i numeri telefonici */}
        {selectedCategory && (
          <EmergencyDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            category={selectedCategory}
          />
        )}
      </div>
    </PageContainer>
  );
}

