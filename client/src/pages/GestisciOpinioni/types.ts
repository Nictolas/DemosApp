export interface Opinione {
  id: string;
  text: string;
  categoria: string;
  gradi_opinione: string[];
}

export interface OpinioneProposta {
  id: string;
  testo: string;
  voti: number;
}

export const GRADI_OPINIONE = ['Europeo', 'Nazionale', 'Regionale', 'Comunale'] as const;
export type GradoOpinione = typeof GRADI_OPINIONE[number];
