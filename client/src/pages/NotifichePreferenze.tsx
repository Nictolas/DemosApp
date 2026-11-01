import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bell, 
  Globe, 
  Building, 
  MapPin, 
  Home, 
  Heart, 
  Users, 
  School, 
  PawPrint, 
  Building2,
  FileText,
  Vote,
  ArrowLeft,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiRequest from "@/lib/api-request";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface PreferenzeNotifiche {
  eurodeputato: boolean;
  senatore: boolean;
  deputato: boolean;
  consigliere_regionale: boolean;
  consigliere_comunale: boolean;
  attivisti: boolean;
  demos: boolean;
  scuola: boolean;
  animali: boolean;
  organizzazioni: boolean;
  iniziative_popolari: boolean;
  referendum_abrogativi: boolean;
  eci: boolean;
}

export default function NotifichePreferenze() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const push = usePushNotifications();
  
  const [preferenze, setPreferenze] = useState<PreferenzeNotifiche>({
    eurodeputato: false,
    senatore: false,
    deputato: false,
    consigliere_regionale: false,
    consigliere_comunale: false,
    attivisti: false,
    demos: false,
    scuola: false,
    animali: true,
    organizzazioni: false,
    iniziative_popolari: false,
    referendum_abrogativi: false,
    eci: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferenze();
    }
  }, [user]);

  const loadPreferenze = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest.get<{ preferenze: PreferenzeNotifiche }>("/notifiche/preferenze");
      
      if (response.success && response.data?.preferenze) {
        setPreferenze((previous) => ({ ...previous, ...response.data.preferenze }));
      } else {
        // Se non ci sono preferenze, usa i default
        console.log("Nessuna preferenza trovata, uso i default");
      }
    } catch (err) {
      console.error("Errore nel caricamento preferenze:", err);
      setError("Errore nel caricamento delle preferenze");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitch = (key: keyof PreferenzeNotifiche, value: boolean) => {
    setPreferenze(prev => ({
      ...prev,
      [key]: value
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await apiRequest.post("/notifiche/preferenze", {
        preferenze
      });
      
      if (response.success) {
        setSaved(true);
        toast({
          title: "Preferenze salvate",
          description: "Le tue preferenze sono state salvate con successo",
        });
        setTimeout(() => setSaved(false), 3000);
      } else {
        throw new Error(response.error || "Errore nel salvataggio");
      }
    } catch (err: any) {
      console.error("Errore nel salvataggio:", err);
      setError(err.message || "Errore nel salvataggio delle preferenze");
      toast({
        title: "Errore",
        description: "Impossibile salvare le preferenze",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const wantsCivicPush = preferenze.iniziative_popolari ||
    preferenze.referendum_abrogativi || preferenze.eci;
  const needsPushPermission = wantsCivicPush && (
    !push.enabled || push.permission !== 'granted'
  );

  const sezioni = [
    {
      title: "Rappresentanti Istituzionali",
      icon: Building,
      items: [
        { key: "eurodeputato" as const, label: "Eurodeputato", description: "Notifiche dal tuo eurodeputato", icon: Globe, color: "text-blue-600" },
        { key: "senatore" as const, label: "Senatore", description: "Notifiche dal tuo senatore", icon: Building, color: "text-red-600" },
        { key: "deputato" as const, label: "Deputato", description: "Notifiche dal tuo deputato", icon: Building, color: "text-green-600" },
        { key: "consigliere_regionale" as const, label: "Consigliere Regionale", description: "Notifiche dal tuo consigliere regionale", icon: MapPin, color: "text-purple-600" },
        { key: "consigliere_comunale" as const, label: "Consigliere Comunale", description: "Notifiche dal tuo consigliere comunale", icon: Home, color: "text-orange-600" },
      ]
    },
    {
      title: "Piattaforma",
      icon: Users,
      items: [
        { key: "demos" as const, label: "Demos", description: "Notifiche generali della piattaforma", icon: Bell, color: "text-indigo-600" },
        { key: "attivisti" as const, label: "Attivisti", description: "Notifiche da attivisti che segui", icon: Heart, color: "text-pink-600" },
        { key: "organizzazioni" as const, label: "Organizzazioni", description: "Notifiche da organizzazioni che segui", icon: Building2, color: "text-teal-600" },
      ]
    },
    {
      title: "Partecipazione popolare",
      icon: Vote,
      items: [
        { key: "iniziative_popolari" as const, label: "Iniziative popolari", description: "Avvisami quando inizia una nuova raccolta firme ufficiale in Italia", icon: FileText, color: "text-emerald-600" },
        { key: "referendum_abrogativi" as const, label: "Referendum abrogativi", description: "Avvisami quando inizia una nuova raccolta firme per un referendum abrogativo", icon: Vote, color: "text-rose-600" },
        { key: "eci" as const, label: "Iniziative dei cittadini europei (ECI)", description: "Avvisami quando parte una nuova iniziativa europea", icon: Globe, color: "text-blue-600" },
      ],
    },
    {
      title: "Altro",
      icon: Bell,
      items: [
        { key: "scuola" as const, label: "Scuola", description: "Notifiche per questioni scolastiche", icon: School, color: "text-yellow-600" },
        { key: "animali" as const, label: "Animali", description: "Notifiche per avvistamenti di animali (volpi, etc)", icon: PawPrint, color: "text-amber-600" },
      ]
    }
  ];

  return (
    <PageContainer className="overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" role="region" aria-label="Impostazioni preferenze notifiche" tabIndex={0}>
        <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/notifiche")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-8 w-8 text-blue-600" />
              Preferenze Notifiche
            </h1>
            <p className="text-gray-600 mt-1">
              Configura come vuoi ricevere le notifiche push
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && needsPushPermission && (
          <Alert className="mb-5 border-amber-300 bg-amber-50">
            <Bell className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-sm text-amber-900">
              {push.permission === 'denied'
                ? 'Hai attivato notifiche in DEMOS, ma il dispositivo le blocca. Abilitale nelle impostazioni del dispositivo per poterle ricevere.'
                : !push.enabled || push.permission === null
                  ? 'Le notifiche push non risultano disponibili su questo dispositivo o browser. Puoi salvare le preferenze, ma non riceverai gli avvisi push qui.'
                  : 'Hai attivato una categoria, ma devi ancora consentire le notifiche sul dispositivo.'}
              {push.enabled && push.permission === 'default' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 block"
                  onClick={() => void push.requestPermission()}
                >
                  Consenti notifiche
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Caricamento preferenze...</span>
          </div>
        ) : (
          <>
            {/* Sezioni Preferenze */}
            <div className="space-y-6 mb-8">
              {sezioni.map((sezione, idx) => {
                const SectionIcon = sezione.icon;
                return (
                  <Card key={idx} className="bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <SectionIcon className="h-5 w-5 text-blue-600" />
                        {sezione.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {sezione.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = preferenze[item.key];
                        return (
                          <div
                            key={item.key}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`p-2 rounded-full bg-white shadow-sm border ${item.color.replace('text-', 'border-')}`}>
                                <ItemIcon className={`h-5 w-5 ${item.color}`} />
                              </div>
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 block">{item.label}</span>
                                <p className="text-sm text-gray-500">{item.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-medium min-w-[70px] text-right ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                {isActive ? 'Attivo' : 'Disattivo'}
                              </span>
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => handleSwitch(item.key, checked)}
                                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

          </>
        )}
        </div>
      </div>
      {!isLoading && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto w-full max-w-4xl">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Salvataggio in corso...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Preferenze salvate!
                  </>
                ) : (
                  "💾 Salva Preferenze"
                )}
              </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}


