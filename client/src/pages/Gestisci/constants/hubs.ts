import { BarChart3, Building2, Users } from "lucide-react";

export interface GestisciHub {
  id: "utenti-verifiche" | "dati-istituzionali" | "ops-center";
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
    title: "Utenti e Proposte",
    description: "Utenti, riconoscimenti, proposte e notifiche.",
    icon: Users,
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    sectionIds: ["utenti", "riconoscimenti", "proposte-soggetti", "opinioni", "notifiche-totali"],
  },
  {
    id: "dati-istituzionali",
    title: "Dati istituzionali",
    description: "Iniziative ministeriali e gestione delle votazioni.",
    icon: Building2,
    buttonColor: "bg-slate-500 hover:bg-slate-600",
    sectionIds: [
      "test-ministero",
      "votazioni-admin",
    ],
  },
  {
    id: "ops-center",
    title: "Sistema e sicurezza",
    description: "Salute, sicurezza, privacy e backup/export.",
    icon: BarChart3,
    buttonColor: "bg-indigo-500 hover:bg-indigo-600",
    sectionIds: [],
    route: "/admin/ops-center",
  },
];
