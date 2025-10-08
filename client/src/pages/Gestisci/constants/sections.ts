import { Users, Vote, Heart, BookOpen, ClipboardList, Trophy, Globe2, BarChart3, Shield, Lock, HardDrive } from "lucide-react";

export interface GestisciSection {
  id: string;
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
    title: "Gestisci Utenti",
    description: "Amministra gli utenti registrati e le loro informazioni",
    icon: Users,
    color: "text-purple-600 group-hover:text-purple-800",
    buttonColor: "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
    route: "/gestisci-utenti",
    buttonText: "Gestisci Utenti"
  },
  {
    id: "elezioni",
    title: "Gestisci Elezioni",
    description: "Crea, modifica ed elimina elezioni e candidature",
    icon: Vote,
    color: "text-pink-600 group-hover:text-pink-800",
    buttonColor: "bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700",
    route: "/gestisci-elezioni",
    buttonText: "Gestisci Elezioni"
  },
  {
    id: "grazia",
    title: "Gestisci Grazia",
    description: "Gestisci le richieste di grazia e i voti associati",
    icon: Heart,
    color: "text-emerald-600 group-hover:text-emerald-800",
    buttonColor: "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
    route: "/gestisci-grazia",
    buttonText: "Gestisci Grazia"
  },
  {
    id: "opinioni",
    title: "Gestisci Opinioni",
    description: "Aggiungi o elimina le opinioni disponibili per gli utenti",
    icon: BookOpen,
    color: "text-blue-600 group-hover:text-blue-800",
    buttonColor: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
    route: "/gestisci-opinioni",
    buttonText: "Gestisci Opinioni"
  },
  {
    id: "iniziative-popolari",
    title: "Gestisci Iniziative Popolari",
    description: "Gestisci le richieste di iniziative popolari proposte dagli utenti",
    icon: ClipboardList,
    color: "text-indigo-600 group-hover:text-indigo-800",
    buttonColor: "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700",
    route: "/gestisci-iniziative-popolari",
    buttonText: "Gestisci Iniziative Popolari"
  },
  {
    id: "referendum-abrogativi",
    title: "Gestisci Referendum Abrogativi",
    description: "Gestisci le richieste di referendum abrogativi proposte dagli utenti",
    icon: Vote,
    color: "text-orange-600 group-hover:text-orange-800",
    buttonColor: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    route: "/gestisci-referendum-abrogativi",
    buttonText: "Gestisci Referendum Abrogativi"
  },
  {
    id: "sondaggi",
    title: "Sondaggi",
    description: "Gestisci e visualizza i sondaggi della piattaforma",
    icon: BarChart3,
    color: "text-violet-600 group-hover:text-violet-800",
    buttonColor: "bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700",
    route: "/sondaggi",
    buttonText: "Gestisci Sondaggi"
  },
  {
    id: "governo",
    title: "Gestisci Governo",
    description: "Gestisci i dati e le funzionalità relative al Governo ideale",
    icon: Trophy,
    color: "text-amber-600 group-hover:text-amber-800",
    buttonColor: "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
    route: "/gestisci-governo",
    buttonText: "Gestisci Governo"
  },
  {
    id: "statistiche-utenti",
    title: "Statistiche Utenti",
    description: "Visualizza dati demografici e statistiche degli utenti registrati",
    icon: Users,
    color: "text-sky-600 group-hover:text-sky-800",
    buttonColor: "bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700",
    route: "/statistiche-utenti",
    buttonText: "Visualizza Statistiche Utenti"
  },
  // Sezioni consolidate
  {
    id: "security-dashboard-consolidated",
    title: "Dashboard Sicurezza e Monitoraggio",
    description: "Panoramica completa di sicurezza, audit logs, violazioni, rate limiting, validazione e performance",
    icon: Shield,
    color: "text-blue-600 group-hover:text-blue-800",
    buttonColor: "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
    route: "/admin/security-dashboard",
    buttonText: "Apri Dashboard Sicurezza"
  },
  {
    id: "gdpr-legal-consolidated",
    title: "Gestione GDPR e Legale",
    description: "Gestisci diritti GDPR, data retention e documenti legali in un'unica interfaccia",
    icon: Lock,
    color: "text-green-600 group-hover:text-green-800",
    buttonColor: "bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700",
    route: "/admin/gdpr-legal",
    buttonText: "Apri Gestione GDPR"
  },
    {
      id: "backup-recovery",
      title: "Backup e Recovery",
      description: "Gestisci backup automatici e manuali del database per continuità operativa",
      icon: HardDrive,
      color: "text-indigo-600 group-hover:text-indigo-800",
      buttonColor: "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700",
      route: "/backup-dashboard",
      buttonText: "Gestisci Backup"
    },
];
