import { Users, BookOpen, ClipboardList, Trophy, Globe2, BarChart3, Shield, Lock, HardDrive } from "lucide-react";

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
    title: "Utenti",
    description: "Gestisci utenti e visualizza statistiche",
    icon: Users,
    color: "text-purple-600 group-hover:text-purple-800",
    buttonColor: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
    route: "/utenti",
    buttonText: "Gestisci Utenti"
  },
  {
    id: "opinioni",
    title: "Gestisci Opinioni",
    description: "Aggiungi o elimina le opinioni disponibili per gli utenti",
    icon: BookOpen,
    color: "text-blue-600 group-hover:text-blue-800",
    buttonColor: "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600",
    route: "/gestisci-opinioni",
    buttonText: "Gestisci Opinioni"
  },
  {
    id: "governo",
    title: "Gestisci Governo",
    description: "Gestisci i dati e le funzionalità relative al Governo ideale",
    icon: Trophy,
    color: "text-amber-600 group-hover:text-amber-800",
    buttonColor: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600",
    route: "/gestisci-governo",
    buttonText: "Gestisci Governo"
  },
  // Sezioni consolidate
  {
    id: "security-dashboard-consolidated",
    title: "Dashboard Sicurezza e Monitoraggio",
    description: "Panoramica completa di sicurezza, audit logs, violazioni, rate limiting, validazione e performance",
    icon: Shield,
    color: "text-blue-600 group-hover:text-blue-800",
    buttonColor: "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600",
    route: "/admin/security-dashboard",
    buttonText: "Apri Dashboard Sicurezza"
  },
  {
    id: "gdpr-legal-consolidated",
    title: "Gestione GDPR e Legale",
    description: "Gestisci diritti GDPR, data retention e documenti legali in un'unica interfaccia",
    icon: Lock,
    color: "text-green-600 group-hover:text-green-800",
    buttonColor: "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600",
    route: "/admin/gdpr-legal",
    buttonText: "Apri Gestione GDPR"
  },
    {
      id: "backup-recovery",
      title: "Backup e Recovery",
      description: "Gestisci backup automatici e manuali del database per continuità operativa",
      icon: HardDrive,
      color: "text-indigo-600 group-hover:text-indigo-800",
      buttonColor: "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600",
      route: "/backup-dashboard",
      buttonText: "Gestisci Backup"
    },
];
