import { Users, Vote, Heart, BookOpen, ClipboardList, Trophy, Globe2, BarChart3, Shield, Database, AlertTriangle, Lock, Eye, FileText } from "lucide-react";

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
    color: "text-purple-600 group-hover:text-purple-700",
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    route: "/gestisci-utenti",
    buttonText: "Gestisci Utenti"
  },
  {
    id: "elezioni",
    title: "Gestisci Elezioni",
    description: "Crea, modifica ed elimina elezioni e candidature",
    icon: Vote,
    color: "text-pink-600 group-hover:text-pink-700",
    buttonColor: "bg-pink-600 hover:bg-pink-700",
    route: "/gestisci-elezioni",
    buttonText: "Gestisci Elezioni"
  },
  {
    id: "grazia",
    title: "Gestisci Grazia",
    description: "Gestisci le richieste di grazia e i voti associati",
    icon: Heart,
    color: "text-green-600 group-hover:text-green-700",
    buttonColor: "bg-green-600 hover:bg-green-700",
    route: "/gestisci-grazia",
    buttonText: "Gestisci Grazia"
  },
  {
    id: "opinioni",
    title: "Gestisci Opinioni",
    description: "Aggiungi o elimina le opinioni disponibili per gli utenti",
    icon: BookOpen,
    color: "text-blue-600 group-hover:text-blue-700",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
    route: "/gestisci-opinioni",
    buttonText: "Gestisci Opinioni"
  },
  {
    id: "iniziative-popolari",
    title: "Gestisci Iniziative Popolari",
    description: "Gestisci le richieste di iniziative popolari proposte dagli utenti",
    icon: ClipboardList,
    color: "text-indigo-600 group-hover:text-indigo-700",
    buttonColor: "bg-indigo-600 hover:bg-indigo-700",
    route: "/gestisci-iniziative-popolari",
    buttonText: "Gestisci Iniziative Popolari"
  },
  {
    id: "referendum-abrogativi",
    title: "Gestisci Referendum Abrogativi",
    description: "Gestisci le richieste di referendum abrogativi proposte dagli utenti",
    icon: Vote,
    color: "text-orange-600 group-hover:text-orange-700",
    buttonColor: "bg-orange-600 hover:bg-orange-700",
    route: "/gestisci-referendum-abrogativi",
    buttonText: "Gestisci Referendum Abrogativi"
  },
  {
    id: "sondaggi",
    title: "Sondaggi",
    description: "Gestisci e visualizza i sondaggi della piattaforma",
    icon: BarChart3,
    color: "text-purple-600 group-hover:text-purple-700",
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    route: "/sondaggi",
    buttonText: "Gestisci Sondaggi"
  },
  {
    id: "governo",
    title: "Gestisci Governo",
    description: "Gestisci i dati e le funzionalità relative al Governo ideale",
    icon: Trophy,
    color: "text-yellow-600 group-hover:text-yellow-700",
    buttonColor: "bg-yellow-600 hover:bg-yellow-700",
    route: "/gestisci-governo",
    buttonText: "Gestisci Governo"
  },
  {
    id: "ice",
    title: "Gestisci ICE",
    description: "Gestisci le richieste di ICE proposte dagli utenti",
    icon: Globe2,
    color: "text-cyan-600 group-hover:text-cyan-700",
    buttonColor: "bg-cyan-600 hover:bg-cyan-700",
    route: "/gestisci-ice",
    buttonText: "Gestisci ICE"
  },
  {
    id: "statistiche-utenti",
    title: "Statistiche Utenti",
    description: "Visualizza dati demografici e statistiche degli utenti registrati",
    icon: Users,
    color: "text-blue-600 group-hover:text-blue-700",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
    route: "/statistiche-utenti",
    buttonText: "Visualizza Statistiche Utenti"
  },
  // Sezioni Sicurezza e Conformità GDPR
  {
    id: "audit-logs",
    title: "Audit Logs",
    description: "Monitora e gestisci i log di audit per la sicurezza e conformità",
    icon: Shield,
    color: "text-red-600 group-hover:text-red-700",
    buttonColor: "bg-red-600 hover:bg-red-700",
    route: "/audit-dashboard",
    buttonText: "Gestisci Audit Logs"
  },
  {
    id: "data-retention",
    title: "Data Retention",
    description: "Gestisci la cancellazione automatica dei dati scaduti secondo GDPR",
    icon: Database,
    color: "text-orange-600 group-hover:text-orange-700",
    buttonColor: "bg-orange-600 hover:bg-orange-700",
    route: "/data-retention",
    buttonText: "Gestisci Data Retention"
  },
  {
    id: "violations",
    title: "Monitoraggio Violazioni",
    description: "Rileva e gestisci violazioni di sicurezza e conformità GDPR",
    icon: AlertTriangle,
    color: "text-yellow-600 group-hover:text-yellow-700",
    buttonColor: "bg-yellow-600 hover:bg-yellow-700",
    route: "/violations-dashboard",
    buttonText: "Monitora Violazioni"
  },
  {
    id: "gdpr-rights",
    title: "Diritti GDPR",
    description: "Gestisci i diritti degli utenti secondo il GDPR (accesso, cancellazione, etc.)",
    icon: Lock,
    color: "text-green-600 group-hover:text-green-700",
    buttonColor: "bg-green-600 hover:bg-green-700",
    route: "/gdpr-rights",
    buttonText: "Gestisci Diritti GDPR"
  },
  {
    id: "security-dashboard",
    title: "Dashboard Sicurezza",
    description: "Panoramica completa dello stato di sicurezza del sistema",
    icon: Eye,
    color: "text-purple-600 group-hover:text-purple-700",
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    route: "/security-dashboard",
    buttonText: "Dashboard Sicurezza"
  },
  {
    id: "legal-documents",
    title: "Documenti Legali",
    description: "Gestisci Privacy Policy, Termini di Servizio e Cookie Policy",
    icon: FileText,
    color: "text-indigo-600 group-hover:text-indigo-700",
    buttonColor: "bg-indigo-600 hover:bg-indigo-700",
    route: "/legal-documents",
    buttonText: "Gestisci Documenti Legali"
  }
];
