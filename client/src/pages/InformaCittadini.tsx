import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Bell, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Tematiche e tipologie per la sezione "Informa Cittadini"
const INFORMA_TEMATICHE = [
  {
    id: "servizi-pubblici",
    nome: "Servizi Pubblici",
    emoji: "🏢",
    bgColor: "from-blue-500 to-cyan-600",
    tipologie: [
      { value: "Interruzione erogazione acqua", emoji: "💧" },
      { value: "Acqua non potabile", emoji: "🚱" },
      { value: "Interruzione energia elettrica programmata", emoji: "⚡" },
      { value: "Variazioni calendario raccolta rifiuti (es. Festività)", emoji: "🗑️" },
      { value: "Sciopero servizio raccolta rifiuti", emoji: "🚛" },
      { value: "Pulizia strade (Divieto di sosta temporaneo)", emoji: "🧹" },
    ]
  },
  {
    id: "viabilita",
    nome: "Viabilità",
    emoji: "🛣️",
    bgColor: "from-orange-500 to-red-500",
    tipologie: [
      { value: "Chiusura strade per lavori", emoji: "🚧" },
      { value: "Modifiche alla viabilità per eventi o manifestazioni", emoji: "🎪" },
      { value: "Blocco del traffico per inquinamento (PM10)", emoji: "🌫️" },
    ]
  },
  {
    id: "scuola",
    nome: "Scuola",
    emoji: "🏫",
    bgColor: "from-teal-500 to-emerald-600",
    tipologie: [
      { value: "Scuole Chiuse", emoji: "🏫" },
      { value: "Scadenza iscrizione Scuolabus", emoji: "🚌" },
      { value: "Scadenza iscrizione Mensa", emoji: "🍽️" },
    ]
  },
  {
    id: "tasse-amministrazione",
    nome: "Tasse e Amministrazione",
    emoji: "📋",
    bgColor: "from-indigo-500 to-purple-600",
    tipologie: [
      { value: "Scadenza IMU", emoji: "🏠" },
      { value: "Scadenza TARI", emoji: "🧾" },
      { value: "Pubblicazione Bandi e Concorsi", emoji: "📢" },
      { value: "Variazione orari uffici comunali", emoji: "🏛️" },
    ]
  },
  {
    id: "sicurezza-ambiente",
    nome: "Sicurezza e Ambiente",
    emoji: "🛡️",
    bgColor: "from-red-600 to-orange-600",
    tipologie: [
      { value: "Disinfestazione zanzare", emoji: "🦟" },
      { value: "Derattizzazione", emoji: "🐀" },
      { value: "Chiusura parchi pubblici per vento forte", emoji: "🌳" },
      { value: "Divieto Botti", emoji: "🎆" },
      { value: "Divieto vendita alcolici", emoji: "🚫🍺" },
      { value: "Avvisi di Protezione Civile (es. rischio incendi, esondazioni)", emoji: "🚨" },
      { value: "Ritrovamento ordigni bellici (Evacuazione)", emoji: "⚠️" },
      { value: "Allerta Meteo", emoji: "🌦️" },
    ]
  },
] as const;

// Array flat di tutte le tipologie per compatibilità con il codice esistente
const INFORMA_TIPOLOGIE = INFORMA_TEMATICHE.flatMap(tematica => 
  tematica.tipologie.map(tipologia => ({
    value: tipologia.value,
    emoji: tipologia.emoji
  }))
);

export default function InformaCittadini() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tematicheSelezionata, setTematicheSelezionata] = useState<string | null>(null);
  const [tipologia, setTipologia] = useState<string>("");
  const [dove, setDove] = useState("");
  const [dalGiorno, setDalGiorno] = useState("");
  const [alGiorno, setAlGiorno] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tuttoComune, setTuttoComune] = useState(false);

  // Mutation per la sezione "Informa Cittadini"
  const submitInformaCittadini = useMutation({
    mutationFn: async (data: {
      tipologia: string;
      dove: string;
      dalGiorno: string;
      alGiorno: string;
    }) => {
      if (!user?.id) {
        throw new Error('ID utente non disponibile. Riprova tra qualche secondo.');
      }

      const payload = {
        tipologia: data.tipologia,
        dove: data.dove,
        dal_giorno: data.dalGiorno,
        al_giorno: data.alGiorno,
        zona: "Generale",
        id_utente: user.id,
      };

      const response = await apiRequest("POST", "/api/informa-cittadini", payload);
      if (!response.ok) {
        throw new Error("Errore nell'invio della comunicazione ai cittadini");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comunicazione inviata",
        description: "L'avviso ai cittadini è stato registrato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
      // Reset form
      setTipologia("");
      setDove("");
      setDalGiorno("");
      setAlGiorno("");
      setTuttoComune(false);
      setTematicheSelezionata(null);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Errore nell'invio:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nell'invio della comunicazione.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!tipologia || (!tuttoComune && !dove.trim()) || !dalGiorno || !alGiorno) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    submitInformaCittadini.mutate({
      tipologia,
      dove: tuttoComune ? "Tutto il comune" : dove.trim(),
      dalGiorno,
      alGiorno,
    });
  };

  // Reset tematica quando si chiude il dialog senza inviare
  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open && !tipologia) {
      // Se il dialog viene chiuso senza aver selezionato una tipologia, resetta anche la tematica
      setTematicheSelezionata(null);
    }
  };

  const tematicaSelezionata = tematicheSelezionata 
    ? INFORMA_TEMATICHE.find(t => t.id === tematicheSelezionata)
    : null;

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Verifica che l'utente abbia accesso (Istituzione o Admin)
  const userRole = user?.ruolo;
  const hasAccess = userRole === "I" || userRole === "AD";

  if (!hasAccess) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            Accesso negato. Questa sezione è accessibile solo alle Istituzioni e agli amministratori.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/strumenti")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-8 w-8 text-emerald-600" />
              Informa Cittadini
            </h1>
            <p className="text-gray-600 mt-1">
              Invia avvisi e comunicazioni ai cittadini del tuo comune
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-600" />
              Nuovo Avviso
            </CardTitle>
            <CardDescription>
              Seleziona una tematica e una tipologia per creare un avviso per i cittadini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!tematicheSelezionata ? (
                <>
                  <label className="text-sm font-medium">Tematica *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {INFORMA_TEMATICHE.map((tematica) => (
                      <Button
                        key={tematica.id}
                        type="button"
                        variant="outline"
                        className={`min-h-[6rem] rounded-2xl border-0 bg-gradient-to-br ${tematica.bgColor} text-white text-sm px-3 py-3 flex flex-col items-center justify-center gap-2 transition-all duration-200 opacity-90 hover:opacity-100 hover:scale-105`}
                        onClick={() => setTematicheSelezionata(tematica.id)}
                      >
                        <span className="text-4xl leading-none">{tematica.emoji}</span>
                        <span className="text-xs text-center leading-snug font-semibold">
                          {tematica.nome}
                        </span>
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTematicheSelezionata(null);
                        setTipologia("");
                      }}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      ← Torna alle tematiche
                    </Button>
                  </div>
                  <label className="text-sm font-medium">Tipologia *</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {tematicaSelezionata?.tipologie.map((tipo) => (
                      <Button
                        key={tipo.value}
                        type="button"
                        variant="outline"
                        className={`min-h-[6.5rem] rounded-2xl border-0 bg-gradient-to-br ${tematicaSelezionata.bgColor} text-white text-sm px-2 py-2 flex flex-col items-center justify-center gap-1 transition-all duration-200
                          ${tipologia === tipo.value ? "ring-2 ring-emerald-500 scale-95" : "opacity-90 hover:opacity-100 hover:scale-105"}`}
                        onClick={() => {
                          setTipologia(tipo.value);
                          setIsDialogOpen(true);
                        }}
                      >
                        <span className="text-3xl leading-none">{tipo.emoji}</span>
                        <span className="text-[11px] text-center leading-snug break-words whitespace-normal">
                          {tipo.value}
                        </span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
              <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                    <span>
                      {INFORMA_TIPOLOGIE.find(t => t.value === tipologia)?.emoji}
                    </span>
                    <span>{tipologia || "Informa Cittadini"}</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dove *</label>
                    <Input
                      type="text"
                      placeholder="Es: Via Roma, quartiere Centro Storico"
                      value={dove}
                      onChange={(e) => setDove(e.target.value)}
                      disabled={tuttoComune}
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="tutto-comune"
                        checked={tuttoComune}
                        onCheckedChange={(checked) => {
                          const value = Boolean(checked);
                          setTuttoComune(value);
                          if (value) {
                            setDove("");
                          }
                        }}
                      />
                      <label
                        htmlFor="tutto-comune"
                        className="text-xs text-gray-700 leading-none cursor-pointer"
                      >
                        Tutto il comune
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Dal giorno *</label>
                      <Input
                        type="date"
                        value={dalGiorno}
                        onChange={(e) => setDalGiorno(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Al giorno *</label>
                      <Input
                        type="date"
                        value={alGiorno}
                        onChange={(e) => setAlGiorno(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      submitInformaCittadini.isPending ||
                      !tipologia ||
                      (!tuttoComune && !dove.trim()) ||
                      !dalGiorno ||
                      !alGiorno
                    }
                    onClick={handleSubmit}
                  >
                    {submitInformaCittadini.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Invia Comunicazione
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}


