import { Users, BookOpen, ClipboardList, Trophy, Globe2, BarChart3, Shield, Lock, HardDrive, Building2, Bell, Vote, Globe, FileSignature, Award } from "lucide-react";

export interface GestisciSection {
  id: string;
  category: "amministrazione" | "monitoraggio-sicurezza" | "comunicazione" | "istituzionale-dati";
  title: string;
  description: string;
  icon: any;
  color: string;
  buttonColor: string;
  route: string;
  buttonText: string;
}

export const gestisciSections: GestisciSection[] = [
  {
    id: "utenti",
    category: "amministrazione",
    title: "Utenti",
    description: "Gestisci utenti e visualizza statistiche",
    icon: Users,
    color: "text-purple-600 group-hover:text-purple-800",
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    route: "/utenti",
    buttonText: "Gestisci Utenti"
  },
  {
    id: "opinioni",
    category: "amministrazione",
    title: "Gestisci Opinioni",
    description: "Aggiungi o elimina le opinioni disponibili per gli utenti",
    icon: BookOpen,
    color: "text-cyan-600 group-hover:text-cyan-800",
    buttonColor: "bg-cyan-500 hover:bg-cyan-600",
    route: "/gestisci-opinioni",
    buttonText: "Gestisci Opinioni"
  },
  {
    id: "governo",
    category: "amministrazione",
    title: "Gestisci Governo",
    description: "Gestisci i dati e le funzionalità relative al Governo ideale",
    icon: Trophy,
    color: "text-amber-600 group-hover:text-amber-800",
    buttonColor: "bg-amber-500 hover:bg-amber-600",
    route: "/gestisci-governo",
    buttonText: "Gestisci Governo"
  },
  {
    id: "test-ministero",
    category: "istituzionale-dati",
    title: "Test Ministero",
    description: "Testa l'integrazione con l'API del Ministero della Giustizia per iniziative e firme",
    icon: Building2,
    color: "text-slate-600 group-hover:text-slate-800",
    buttonColor: "bg-slate-500 hover:bg-slate-600",
    route: "/test-ministero",
    buttonText: "Test Ministero"
  },
  // Sezioni consolidate
  {
    id: "ops-center",
    category: "monitoraggio-sicurezza",
    title: "Ops Center",
    description: "Hub unico per Monitoring, Security e Compliance",
    icon: BarChart3,
    color: "text-indigo-600 group-hover:text-indigo-800",
    buttonColor: "bg-indigo-500 hover:bg-indigo-600",
    route: "/admin/ops-center/monitoring",
    buttonText: "Apri Ops Center"
  },
  {
    id: "data-export",
    category: "istituzionale-dati",
    title: "Export Dati su Hard Disk",
    description: "Esporta dati storici dal database Neon su hard disk esterno per alleggerire il database",
    icon: HardDrive,
    color: "text-blue-600 group-hover:text-blue-800",
    buttonColor: "bg-blue-500 hover:bg-blue-600",
    route: "/admin/data-export",
    buttonText: "Gestisci Export"
  },
    {
      id: "backup-recovery",
      category: "monitoraggio-sicurezza",
      title: "Backup e Recovery",
      description: "Gestisci backup automatici e manuali del database per continuità operativa",
      icon: HardDrive,
      color: "text-indigo-600 group-hover:text-indigo-800",
      buttonColor: "bg-indigo-500 hover:bg-indigo-600",
      route: "/backup-dashboard",
      buttonText: "Gestisci Backup"
    },
    {
      id: "notifiche-totali",
      category: "comunicazione",
      title: "Notifiche Totali",
      description: "Visualizza e gestisci tutte le notifiche del sistema",
      icon: Bell,
      color: "text-pink-600 group-hover:text-pink-800",
      buttonColor: "bg-pink-500 hover:bg-pink-600",
      route: "/notifiche-totali",
      buttonText: "Notifiche Totali"
    },
    {
      id: "notifiche-demos",
      category: "comunicazione",
      title: "Notifiche Demos",
      description: "Invia notifiche push a tutti gli utenti con preferenze Demos attivate",
      icon: Bell,
      color: "text-indigo-600 group-hover:text-indigo-800",
      buttonColor: "bg-indigo-500 hover:bg-indigo-600",
      route: "/gestisci/notifiche-demos",
      buttonText: "Notifiche Demos"
    },
    {
      id: "voti-politici",
      category: "istituzionale-dati",
      title: "Voti Politici",
      description: "Visualizza le votazioni della Camera dei Deputati dell'ultima legislatura",
      icon: Vote,
      color: "text-blue-600 group-hover:text-blue-800",
      buttonColor: "bg-blue-500 hover:bg-blue-600",
      route: "/voti-politici",
      buttonText: "Voti Politici"
    },
    {
      id: "voti-parlamento",
      category: "istituzionale-dati",
      title: "Voti Parlamento",
      description: "Visualizza le ultime votazioni del Parlamento (Camera e Senato) in ordine cronologico",
      icon: Vote,
      color: "text-green-600 group-hover:text-green-800",
      buttonColor: "bg-green-500 hover:bg-green-600",
      route: "/voti-parlamento",
      buttonText: "Voti Parlamento"
    },
    {
      id: "voti-parlamento-europeo",
      category: "istituzionale-dati",
      title: "Voti Parlamento Europeo",
      description: "Visualizza le ultime votazioni del Parlamento Europeo in ordine cronologico",
      icon: Globe,
      color: "text-blue-600 group-hover:text-blue-800",
      buttonColor: "bg-blue-500 hover:bg-blue-600",
      route: "/voti-parlamento-europeo",
      buttonText: "Parlamento Europeo"
    },
    {
      id: "eci",
      category: "istituzionale-dati",
      title: "ECI",
      description: "Lista delle Iniziative dei Cittadini Europei (ICE) e numero di firme",
      icon: FileSignature,
      color: "text-teal-600 group-hover:text-teal-800",
      buttonColor: "bg-teal-500 hover:bg-teal-600",
      route: "/eci",
      buttonText: "ECI"
    },
    {
      id: "riconoscimenti",
      category: "amministrazione",
      title: "Riconoscimenti",
      description: "Approva o rifiuta le richieste di riconoscimento come politico o candidato",
      icon: Award,
      color: "text-emerald-600 group-hover:text-emerald-800",
      buttonColor: "bg-emerald-500 hover:bg-emerald-600",
      route: "/gestisci/riconoscimenti",
      buttonText: "Riconoscimenti"
    },
  ];

export const gestisciCategoryOrder: Array<GestisciSection["category"]> = [
  "amministrazione",
  "monitoraggio-sicurezza",
  "comunicazione",
  "istituzionale-dati"
];

export const gestisciCategoryMeta: Record<GestisciSection["category"], { title: string; description: string }> = {
  "amministrazione": {
    title: "Amministrazione",
    description: "Gestione utenti, riconoscimenti, opinioni e governo."
  },
  "monitoraggio-sicurezza": {
    title: "Monitoraggio e Sicurezza",
    description: "Controllo salute sistema, sicurezza, GDPR e backup."
  },
  "comunicazione": {
    title: "Comunicazione",
    description: "Gestione notifiche e comunicazioni verso utenti."
  },
  "istituzionale-dati": {
    title: "Dati Istituzionali ed Export",
    description: "Fonti istituzionali, votazioni, ECI e export dati."
  }
};
