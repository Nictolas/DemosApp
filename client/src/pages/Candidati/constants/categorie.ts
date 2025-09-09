import { Categoria } from "../types";

export const categorie: Categoria[] = [
  { id: "europeo", nome: "Parlamento Europeo", color: "blue" },
  { id: "camera", nome: "Camera dei Deputati", color: "green" },
  { id: "senato", nome: "Senato della Repubblica", color: "purple" },
  { id: "regione", nome: "Consiglio Regionale", color: "orange" },
  { id: "comune", nome: "Consiglio Comunale", color: "teal" }
];

export const colorMap = { 
  blue: { bg: "#dbeafe", text: "#1e40af", icon: "#2563eb" },
  green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" }, 
  purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" }, 
  orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" },
  teal: { bg: "#a7f3d0", text: "#064e3b", icon: "#0d9488" }
};
