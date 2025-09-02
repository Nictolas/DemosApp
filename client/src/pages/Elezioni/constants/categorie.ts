import { Categoria } from "../types";

export const categorie: Categoria[] = [
  { id: "europeo", nome: "Parlamento Europeo", field: "candidato_europeo", color: "blue", tipoElezione: "sovranazione" },
  { id: "camera", nome: "Camera dei Deputati", field: "candidato_camera", color: "green", tipoElezione: "stato" },
  { id: "senato", nome: "Senato della Repubblica", field: "candidato_senato", color: "purple", tipoElezione: "stato" },
  { id: "regione", nome: "Consiglio Regionale", field: "candidato_regione", color: "orange", tipoElezione: "regione" },
  { id: "comune", nome: "Consiglio Comunale", field: "candidato_comune", color: "teal", tipoElezione: "comune" }
];

export const colorMap = { 
  green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" }, 
  purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" }, 
  orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" },
  teal: { bg: "#a7f3d0", text: "#134e4a", icon: "#0d9488" }
};
