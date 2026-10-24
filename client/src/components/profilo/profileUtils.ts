import { ProfileOpinion, CategorizedOpinions, OpinionQuestion } from "./types";

// Mappatura degli ID delle opinioni ai loro argomenti
const baseOpinionsMap: Record<string, string> = {
  'energia_nucleare': 'Energia Nucleare',
  'sperimentazione_animale': 'Sperimentazione Animale',
  'legalizzazione_canapa': 'Legalizzazione Canapa',
  'caccia': 'Caccia',
  'cittadina_animale': 'Cittadinanza Animale',
  'eutanasia': 'Eutanasia',
  'case_chiuse': 'Case Chiuse',
  'salario_minimo': 'Salario Minimo',
  'matrimonio_gay': 'Matrimonio Gay',
  'nato': 'NATO',
  'omobitransfobia': 'Legge contro l\'omobitransfobia'
};

// Get opinion label from question text
export const getOpinionLabel = (id: string, opinionQuestions: OpinionQuestion[]): string => {
  const q = opinionQuestions.find(q => q.id === id);
  return q ? q.text : id;
};

// Get opinion topic from ID and question text
export const getOpinionTopic = (id: string, questionText: string): string => {
  // Se è un'opinione base, usa la mappatura
  if (baseOpinionsMap[id]) {
    return baseOpinionsMap[id];
  }
  
  // Per le opinioni dinamiche, estrai l'argomento dalla domanda
  if (questionText) {
    // Rimuovi "Sei favorevole a" o "Sei favorevole alla" dall'inizio
    let topic = questionText.replace(/^Sei favorevole (a|alla) /i, '');
    
    // Rimuovi il punto interrogativo alla fine
    topic = topic.replace(/\?$/, '');
    
    // Capitalizza la prima lettera
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);
    
    return topic;
  }
  
  // Fallback: usa l'ID
  return id;
};

// Categorize all opinions into favorevoli, indecisi, contrari
export const categorizeAllOpinions = (
  userOpinions: Record<string, string>, 
  opinionQuestions: OpinionQuestion[]
): CategorizedOpinions => {
  const allOpinionKeys = Array.from(new Set([
    ...(Array.isArray(opinionQuestions) ? opinionQuestions.map(q => q.id) : []),
    ...Object.keys(userOpinions)
  ]));

  const favorevoli: ProfileOpinion[] = [];
  const indecisi: ProfileOpinion[] = [];
  const contrari: ProfileOpinion[] = [];

  allOpinionKeys.forEach((key) => {
    const value = userOpinions[key];
    if (!value) return;
    
    const q = Array.isArray(opinionQuestions) ? opinionQuestions.find(q => q.id === key) : null;
    const label = getOpinionTopic(key, q?.text || '');
    
    if (value === "Favorevole") favorevoli.push({ id: key, label });
    else if (value === "Indeciso") indecisi.push({ id: key, label });
    else if (value === "Contrario") contrari.push({ id: key, label });
  });

  return { favorevoli, indecisi, contrari };
};

// Check if user can edit image
export const canEditImage = (userRole: string): boolean => {
  return userRole === 'P' || userRole === 'C' || userRole === 'CP' || userRole === 'AD';
};

// Get back button text
export const getBackButtonText = (fromGestisciUtenti: boolean, userId?: string): string => {
  if (fromGestisciUtenti) return "Torna a Utenti";
  if (userId) return "Torna a Gestisci Grazia";
  return "Torna ai Preferiti";
};
