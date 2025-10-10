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
    buttonColor: "bg-purple-600 hover:bg-purple-700",
    route: "/utenti",
    buttonText: "Gestisci Utenti"
  },
  {
    id: "opinioni",
    title: "Gestisci Opinioni",
    description: "Aggiungi o elimina le opinioni disponibili per gli utenti",
    icon: BookOpen,
    color: "text-blue-600 group-hover:text-blue-800",
    buttonColor: "bg-blue-500 hover:bg-blue-600",
    route: "/gestisci-opinioni",
    buttonText: "Gestisci Opinioni"
  },
  {
    id: "governo",
    title: "Gestisci Governo",
    description: "Gestisci i dati e le funzionalità relative al Governo ideale",
    icon: Trophy,
    color: "text-amber-600 group-hover:text-amber-800",
    buttonColor: "bg-orange-500 hover:bg-orange-600",
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
    buttonColor: "bg-red-600 hover:bg-red-700",
    route: "/admin/security-dashboard",
    buttonText: "Apri Dashboard Sicurezza"
  },
  {
    id: "gdpr-legal-consolidated",
    title: "Gestione GDPR e Legale",
    description: "Gestisci diritti GDPR, data retention e documenti legali in un'unica interfaccia",
    icon: Lock,
    color: "text-green-600 group-hover:text-green-800",
    buttonColor: "bg-green-600 hover:bg-green-700",
    route: "/admin/gdpr-legal",
    buttonText: "Apri Gestione GDPR"
  },
    {
      id: "backup-recovery",
      title: "Backup e Recovery",
      description: "Gestisci backup automatici e manuali del database per continuità operativa",
      icon: HardDrive,
      color: "text-indigo-600 group-hover:text-indigo-800",
      buttonColor: "bg-gray-700 hover:bg-gray-800",
      route: "/backup-dashboard",
      buttonText: "Gestisci Backup"
    },
];
