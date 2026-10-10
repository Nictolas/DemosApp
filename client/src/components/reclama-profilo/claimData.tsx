import { Crown, BarChart3, MessageCircle, Users } from "lucide-react";
import { PremiumBenefit, AccountType } from "./types";

export const premiumBenefits: PremiumBenefit[] = [
  {
    icon: <Crown className="h-5 w-5 text-yellow-500" />,
    title: "Badge verificato",
    description: "Riconoscimento ufficiale del tuo ruolo istituzionale"
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-blue-500" />,
    title: "Dashboard elettorale",
    description: "Analisi e report costanti delle preferenze in tempo reale"
  },
  {
    icon: <MessageCircle className="h-5 w-5 text-green-500" />,
    title: "Canale diretto",
    description: "Notifiche push e comunicazioni personalizzate ai tuoi sostenitori"
  },
  {
    icon: <Users className="h-5 w-5 text-purple-500" />,
    title: "Strumenti di engagement",
    description: "Statistiche e sondaggi per coinvolgere il tuo elettorato"
  }
];

export const accountTypes: AccountType[] = [
  {
    name: "Demos Voter",
    price: "Gratuito",
    period: "per sempre",
    description: "Per chi: Gli elettori e i cittadini che vogliono interagire con la politica",
    features: [
      "Esprimere le proprie opinioni su temi importanti",
      "Trovare rappresentanti e candidati con ideologie compatibili",
      "Votare simbolicamente per capo di stato, amnistia, grazia e governo ideale",
      "Ricevere aggiornamenti costanti sulle votazioni"
    ],
    color: "blue"
  },
  {
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
    color: "green"
  },
  {
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
    popular: true
  },
  {
    name: "Demos Plus",
    price: "69 €",
    period: "all'anno",
    description: "Per chi: Politici già eletti che si preparano alle prossime elezioni",
    features: [
      "Tutto di Demos Rep",
      "Analisi avanzata dell'elettorato e delle tendenze",
      "Strumenti di campagna elettorale e comunicazione strategica",
      "Supporto personalizzato per la gestione della campagna",
      "Accesso prioritario alle nuove funzionalità"
    ],
    color: "orange"
  }
];
