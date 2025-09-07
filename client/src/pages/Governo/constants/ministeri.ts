import { User, Building2, Shield, Scale, Banknote, Briefcase, GraduationCap, Heart, Palette, Leaf } from "lucide-react";

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
    nome: "Ministro degli Esteri", 
    categoria: "esteri", 
    icon: Building2, 
    color: "blue",
    slug: "esteri"
  },
  { 
    id: "interno",
    nome: "Ministro dell'Interno", 
    categoria: "interno", 
    icon: Shield, 
    color: "green",
    slug: "interno"
  },
  { 
    id: "giustizia",
    nome: "Ministro della Giustizia", 
    categoria: "giustizia", 
    icon: Scale, 
    color: "purple",
    slug: "giustizia"
  },
  { 
    id: "difesa",
    nome: "Ministro della Difesa", 
    categoria: "difesa", 
    icon: Shield, 
    color: "gray",
    slug: "difesa"
  },
  { 
    id: "economia",
    nome: "Ministro dell'Economia", 
    categoria: "economia", 
    icon: Banknote, 
    color: "yellow",
    slug: "economia"
  },
  { 
    id: "lavoro",
    nome: "Ministro del Lavoro", 
    categoria: "lavoro", 
    icon: Briefcase, 
    color: "orange",
    slug: "lavoro"
  },
  { 
    id: "istruzione",
    nome: "Ministro dell'Istruzione", 
    categoria: "istruzione", 
    icon: GraduationCap, 
    color: "indigo",
    slug: "istruzione"
  },
  { 
    id: "salute",
    nome: "Ministro della Salute", 
    categoria: "salute", 
    icon: Heart, 
    color: "pink",
    slug: "salute"
  },
  { 
    id: "cultura",
    nome: "Ministro della Cultura", 
    categoria: "cultura", 
    icon: Palette, 
    color: "teal",
    slug: "cultura"
  },
  { 
    id: "ambiente_sicurezza_energetica",
    nome: "Ministro dell'Ambiente", 
    categoria: "ambiente_sicurezza_energetica", 
    icon: Leaf, 
    color: "lime",
    slug: "ambiente"
  }
];

export const colorMap = {
  red: { bg: "#fef2f2", text: "#dc2626", icon: "#ef4444" },
  blue: { bg: "#eff6ff", text: "#2563eb", icon: "#3b82f6" },
  green: { bg: "#f0fdf4", text: "#16a34a", icon: "#22c55e" },
  purple: { bg: "#faf5ff", text: "#9333ea", icon: "#a855f7" },
  gray: { bg: "#f9fafb", text: "#6b7280", icon: "#9ca3af" },
  yellow: { bg: "#fefce8", text: "#ca8a04", icon: "#eab308" },
  orange: { bg: "#fff7ed", text: "#ea580c", icon: "#f97316" },
  indigo: { bg: "#eef2ff", text: "#4338ca", icon: "#6366f1" },
  pink: { bg: "#fdf2f8", text: "#db2777", icon: "#ec4899" },
  teal: { bg: "#f0fdfa", text: "#0d9488", icon: "#14b8a6" },
  lime: { bg: "#f7fee7", text: "#65a30d", icon: "#84cc16" }
};
