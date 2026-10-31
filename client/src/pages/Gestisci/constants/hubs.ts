import { BarChart3, Bell, BookOpen, Building2, Users } from "lucide-react";

export interface GestisciHub {
  id: "utenti-verifiche" | "contenuti" | "comunicazioni" | "dati-istituzionali" | "ops-center";
  title: string;
  description: string;
  icon: any;
  buttonColor: string;
  sectionIds: string[];
  route?: string;
}

export const gestisciHubs: GestisciHub[] = [
  {
    id: "utenti-verifiche",
    title: "Utenti e verifiche",
    description: "Account, statistiche e richieste di riconoscimento.",
    icon: Users,
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    sectionIds: ["utenti", "riconoscimenti", "proposte-soggetti", "grazia-proposte"],
  },
  {
    id: "contenuti",
    title: "Contenuti",
    description: "Opinioni e configurazione del Governo ideale.",
    icon: BookOpen,
    buttonColor: "bg-cyan-500 hover:bg-cyan-600",
    sectionIds: ["opinioni", "governo"],
  },
  {
    id: "comunicazioni",
    title: "Comunicazioni",
    description: "Invio, diagnostica e cronologia delle notifiche DEMOS.",
    icon: Bell,
    buttonColor: "bg-pink-500 hover:bg-pink-600",
    sectionIds: ["notifiche-totali"],
  },
  {
    id: "dati-istituzionali",
    title: "Dati istituzionali",
    description: "Ministero, votazioni parlamentari e iniziative europee.",
    icon: Building2,
    buttonColor: "bg-slate-500 hover:bg-slate-600",
    sectionIds: [
      "test-ministero",
      "voti-politici",
      "voti-parlamento",
      "voti-parlamento-europeo",
      "eci",
    ],
  },
  {
    id: "ops-center",
    title: "Ops Center",
    description: "Salute sistema, sicurezza, GDPR, backup ed export.",
    icon: BarChart3,
    buttonColor: "bg-indigo-500 hover:bg-indigo-600",
    sectionIds: [],
    route: "/admin/ops-center",
  },
];
