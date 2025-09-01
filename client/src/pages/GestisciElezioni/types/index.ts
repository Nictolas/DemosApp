// Interfaccia corretta per corrispondere ai dati di Firestore migrati
export interface Elezione {
  id: string;
  tipo: string; // 'sovranazione', 'stato', 'regione', 'provincia', 'comune'
  zona: string;
  circa: boolean;
  datainizio: string; // Anno come stringa
  datafine: string; // Anno come stringa
  createdAt: string;
  updatedAt: string;
}

export type TipoElezione = 'sovranazione' | 'stato' | 'regione' | 'provincia' | 'comune';
