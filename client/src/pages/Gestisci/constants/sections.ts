import { Users, Vote, Heart, BookOpen, ClipboardList, Trophy, Globe2, BarChart3, Shield, Database, AlertTriangle, Lock, Eye, FileText, HardDrive, Zap, CheckCircle, FileSearch } from "lucide-react";

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
    id: "ice",
    title: "Gestisci ICE",
    description: "Gestisci le richieste di ICE proposte dagli utenti",
    icon: Globe2,
    color: "text-teal-600 group-hover:text-teal-800",
    buttonColor: "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700",
    route: "/gestisci-ice",
    buttonText: "Gestisci ICE"
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
  // Sezioni Sicurezza e Conformità GDPR
  {
    id: "audit-logs",
    title: "Audit Logs",
    description: "Monitora e gestisci i log di audit per la sicurezza e conformità",
    icon: Shield,
    color: "text-red-600 group-hover:text-red-800",
    buttonColor: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
    route: "/audit-dashboard",
    buttonText: "Gestisci Audit Logs"
  },
  {
    id: "data-retention",
    title: "Data Retention",
    description: "Gestisci la cancellazione automatica dei dati scaduti secondo GDPR",
    icon: Database,
    color: "text-rose-600 group-hover:text-rose-800",
    buttonColor: "bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700",
    route: "/data-retention",
    buttonText: "Gestisci Data Retention"
  },
  {
    id: "violations",
    title: "Monitoraggio Violazioni",
    description: "Rileva e gestisci violazioni di sicurezza e conformità GDPR",
    icon: AlertTriangle,
    color: "text-yellow-600 group-hover:text-yellow-800",
    buttonColor: "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
    route: "/violations-dashboard",
    buttonText: "Monitora Violazioni"
  },
  {
    id: "gdpr-rights",
    title: "Diritti GDPR",
    description: "Gestisci i diritti degli utenti secondo il GDPR (accesso, cancellazione, etc.)",
    icon: Lock,
    color: "text-green-600 group-hover:text-green-800",
    buttonColor: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    route: "/gdpr-rights",
    buttonText: "Gestisci Diritti GDPR"
  },
  {
    id: "security-dashboard",
    title: "Dashboard Sicurezza",
    description: "Panoramica completa dello stato di sicurezza del sistema",
    icon: Eye,
    color: "text-slate-600 group-hover:text-slate-800",
    buttonColor: "bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700",
    route: "/security-dashboard",
    buttonText: "Dashboard Sicurezza"
  },
  {
    id: "legal-documents",
    title: "Documenti Legali",
    description: "Gestisci Privacy Policy, Termini di Servizio e Cookie Policy",
    icon: FileText,
    color: "text-slate-600 group-hover:text-slate-800",
    buttonColor: "bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700",
    route: "/legal-documents",
    buttonText: "Gestisci Documenti Legali"
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
    {
      id: "rate-limiting",
      title: "Rate Limiting",
      description: "Monitora e gestisci le violazioni di rate limiting per la sicurezza dell'API",
      icon: Zap,
      color: "text-yellow-600 group-hover:text-yellow-800",
      buttonColor: "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
      route: "/rate-limiting-dashboard",
      buttonText: "Monitora Rate Limiting"
    },
    {
      id: "validation",
      title: "Validazione Input",
      description: "Monitora e gestisci i fallimenti di validazione per la sicurezza dell'applicazione",
      icon: CheckCircle,
      color: "text-teal-600 group-hover:text-teal-800",
      buttonColor: "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700",
      route: "/validation-dashboard",
      buttonText: "Monitora Validazione"
    },
    {
      id: "logging",
      title: "Logging Centralizzato",
      description: "Monitora e gestisci tutti i log dell'applicazione in un sistema unificato",
      icon: FileSearch,
      color: "text-cyan-600 group-hover:text-cyan-800",
      buttonColor: "bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700",
      route: "/logging-dashboard",
      buttonText: "Gestisci Logging"
    }
];
