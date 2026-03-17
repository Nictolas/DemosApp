import { User, Building2, Shield, Scale, Banknote, Briefcase, GraduationCap, Heart, Palette, Leaf, Train } from "lucide-react";

export const ministeri = [
  { 
    id: "primo_ministro",
    nome: "Primo Ministro", 
    categoria: "primo_ministro", 
    icon: User, 
    color: "red",
    slug: "primo-ministro"
  },
  { 
    id: "esteri",
    nome: "Esteri", 
    categoria: "esteri", 
    icon: Building2, 
    color: "blue",
    slug: "esteri"
  },
  { 
    id: "interno",
    nome: "Interno", 
    categoria: "interno", 
    icon: Shield, 
    color: "green",
    slug: "interno"
  },
  { 
    id: "giustizia",
    nome: "Giustizia", 
    categoria: "giustizia", 
    icon: Scale, 
    color: "purple",
    slug: "giustizia"
  },
  { 
    id: "difesa",
    nome: "Difesa", 
    categoria: "difesa", 
    icon: Shield, 
    color: "gray",
    slug: "difesa"
  },
  { 
    id: "economia",
    nome: "Economia", 
    categoria: "economia", 
    icon: Banknote, 
    color: "yellow",
    slug: "economia"
  },
  { 
    id: "lavoro",
    nome: "Lavoro", 
    categoria: "lavoro", 
    icon: Briefcase, 
    color: "orange",
    slug: "lavoro"
  },
  { 
    id: "istruzione",
    nome: "Istruzione", 
    categoria: "istruzione", 
    icon: GraduationCap, 
    color: "indigo",
    slug: "istruzione"
  },
  { 
    id: "salute",
    nome: "Salute", 
    categoria: "salute", 
    icon: Heart, 
    color: "pink",
    slug: "salute"
  },
  { 
    id: "cultura",
    nome: "Cultura", 
    categoria: "cultura", 
    icon: Palette, 
    color: "teal",
    slug: "cultura"
  },
  { 
    id: "ambiente",
    nome: "Ambiente", 
    categoria: "ambiente", 
    icon: Leaf, 
    color: "lime",
    slug: "ambiente"
  },
  { 
    id: "trasporti",
    nome: "Trasporti", 
    categoria: "trasporti", 
    icon: Train, 
    color: "indigo",
    slug: "trasporti"
  }
];

export const colorMap = {
  red: { bg: "#ef4444", text: "#ffffff", icon: "#ffffff" },
  blue: { bg: "#3b82f6", text: "#ffffff", icon: "#ffffff" },
  green: { bg: "#22c55e", text: "#ffffff", icon: "#ffffff" },
  purple: { bg: "#a855f7", text: "#ffffff", icon: "#ffffff" },
  gray: { bg: "#6b7280", text: "#ffffff", icon: "#ffffff" },
  yellow: { bg: "#eab308", text: "#ffffff", icon: "#ffffff" },
  orange: { bg: "#f97316", text: "#ffffff", icon: "#ffffff" },
  indigo: { bg: "#6366f1", text: "#ffffff", icon: "#ffffff" },
  pink: { bg: "#ec4899", text: "#ffffff", icon: "#ffffff" },
  teal: { bg: "#14b8a6", text: "#ffffff", icon: "#ffffff" },
  lime: { bg: "#84cc16", text: "#ffffff", icon: "#ffffff" }
};
