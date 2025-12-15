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
  bgClass: string;
  numbers: Array<{
    number: string;
    label: string;
    description?: string;
  }>;
}

interface EmergencySection {
  id: string;
  title: string;
  categories: string[]; // array di id delle categorie
}

const emergencyCategories: EmergencyCategory[] = [
  {
    id: "animali-feriti",
    title: "Animali feriti",
    description: "Segnala animali selvatici feriti",
    icon: "🐾",
    bgClass: "from-emerald-500 to-green-500",
    numbers: [
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  },
  {
    id: "uccelli-feriti",
    title: "Uccelli feriti",
    description: "Segnala uccelli feriti o in difficoltà",
    icon: "🦅",
    bgClass: "from-sky-400 to-blue-500",
    numbers: [
      { number: "1515", label: "1515", description: "Carabinieri Forestali" },
      { number: "0521273043", label: "LIPU 0521 273043", description: "Lega Italiana Protezione Uccelli" }
    ]
  },
  {
    id: "lupi",
    title: "Lupi pericolosi",
    description: "Segnala lupi pericolosi o troppo vicini alle abitazioni",
    icon: "🐺",
    bgClass: "from-slate-700 to-slate-900",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" },
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  },
  {
    id: "cinghiali",
    title: "Cinghiali pericolosi",
    description: "Segnala cinghiali pericolosi o in gruppo",
    icon: "🐗",
    bgClass: "from-amber-700 to-orange-700",
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
    bgClass: "from-red-600 to-orange-500",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" },
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  },
  {
    id: "frane",
    title: "Frane / smottamenti",
    description: "Segnala pericoli strutturali",
    icon: "⛰️",
    bgClass: "from-stone-500 to-stone-700",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" }
    ]
  },
  {
    id: "albero-pericolante",
    title: "Albero pericolante",
    description: "Segnala alberi pericolanti o rami a rischio caduta",
    icon: "🌳",
    bgClass: "from-lime-600 to-green-700",
    numbers: [
      { number: "115", label: "115", description: "Vigili del Fuoco" }
    ]
  },
  {
    id: "veicoli-sospetti",
    title: "Veicoli sospetti / ricercati",
    description: "Segnala veicoli sospetti",
    icon: "🚗",
    bgClass: "from-indigo-500 to-indigo-700",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "veicolo-abbandonato",
    title: "Veicolo abbandonato",
    description: "Segnala veicoli abbandonati o senza targa",
    icon: "🚙",
    bgClass: "from-sky-700 to-blue-800",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "persona-scomparsa",
    title: "Persona scomparsa / avvistata",
    description: "Segnala persone scomparse o avvistate",
    icon: "👤",
    bgClass: "from-amber-500 to-yellow-500",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "persona-difficolta",
    title: "SOS Persona in difficoltà",
    description: "Segnala persone in difficoltà",
    icon: "🆘",
    bgClass: "from-rose-500 to-pink-600",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" }
    ]
  },
  {
    id: "attivita-illegali",
    title: "Attività illegali",
    description: "Segnala attività illegali",
    icon: "🚨",
    bgClass: "from-red-700 to-red-900",
    numbers: [
      { number: "112", label: "112", description: "Numero Unico di Emergenza" },
      { number: "117", label: "117", description: "Guardia di Finanza" }
    ]
  },
  {
    id: "illuminazione",
    title: "Illuminazione pubblica guasta",
    description: "Segnala problemi stradali",
    icon: "💡",
    bgClass: "from-yellow-300 to-amber-400",
    numbers: [
      { number: "1518", label: "1518", description: "Viabilità ANAS" }
    ]
  },
  {
    id: "buca-stradale",
    title: "Buca stradale",
    description: "Segnala buche pericolose sulla strada",
    icon: "🕳️",
    bgClass: "from-slate-500 to-slate-700",
    numbers: [
      { number: "1518", label: "1518", description: "Viabilità ANAS" }
    ]
  },
  {
    id: "discarica-abusiva",
    title: "Discarica abusiva",
    description: "Segnala discariche abusive o rifiuti pericolosi",
    icon: "🗑️",
    bgClass: "from-emerald-700 to-green-800",
    numbers: [
      { number: "1515", label: "1515", description: "Carabinieri Forestali" }
    ]
  }
];

const emergencySections: EmergencySection[] = [
  {
    id: "emergenze",
    title: "Emergenze",
    categories: [
      "incendi",
      "animali-feriti",
      "uccelli-feriti",
      "persona-scomparsa",
      "persona-difficolta",
      "lupi",
      "cinghiali"
    ]
  },
  {
    id: "decoro-urbano",
    title: "Decoro urbano",
    categories: [
      "illuminazione",
      "buca-stradale",
      "frane",
      "albero-pericolante",
      "discarica-abusiva",
      "veicolo-abbandonato"
    ]
  },
  {
    id: "sicurezza",
    title: "Sicurezza e ordine pubblico",
    categories: [
      "veicoli-sospetti",
      "attivita-illegali"
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

        {/* Grid delle categorie, divise in tre sezioni e tre colonne */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {emergencySections.map((section) => (
              <div key={section.id} className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  {section.title}
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {section.categories.map((categoryId) => {
                    const category = emergencyCategories.find((c) => c.id === categoryId);
                    if (!category) return null;

                    return (
                      <Button
                        key={category.id}
                        variant="outline"
                        className={`w-full h-28 rounded-2xl border-0 bg-gradient-to-br ${category.bgClass} hover:brightness-110 hover:shadow-xl transition-all duration-300 p-0`}
                        onClick={() => handleCategoryClick(category)}
                      >
                        <div className="flex flex-col items-center justify-center w-full h-full gap-2 text-white">
                          <div className="text-5xl leading-none">
                            {category.icon}
                          </div>
                          <div className="text-center px-2">
                            <div className="font-semibold text-xs sm:text-sm">
                              {category.title}
                            </div>
                            <div className="text-[10px] sm:text-xs opacity-90">
                              {category.description}
                            </div>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
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

