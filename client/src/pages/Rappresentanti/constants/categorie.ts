import { Categoria } from "../types";

export const categorie: Categoria[] = [
  { id: "europeo", nome: "Parlamento Europeo", color: "blue" },
  { id: "camera", nome: "Camera dei Deputati", color: "green" },
  { id: "senato", nome: "Senato della Repubblica", color: "purple" },
  { id: "regione", nome: "Consiglio Regionale", color: "orange" },
  { id: "comune", nome: "Consiglio Comunale", color: "teal" }
];

export const colorMap = { 
  green: "#bbf7d0", 
  purple: "#ede9fe", 
  orange: "#fef9c3", 
  teal: "#a7f3d0" 
};
