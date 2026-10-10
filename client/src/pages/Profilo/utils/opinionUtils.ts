import { OpinionQuestion, CategorizedOpinions, ProfileOpinion } from '../types';

/**
 * Mappatura degli ID delle opinioni ai loro argomenti
 */
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

/**
 * Ottiene l'etichetta per un'opinione basata sull'ID
 */
export const getOpinionLabel = (id: string, opinionQuestions: OpinionQuestion[]): string => {
  const question = opinionQuestions.find(q => q.id === id);
  return question ? question.text : id;
};

/**
 * Ottiene l'argomento di un'opinione basato sull'ID e sul testo della domanda
 */
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

/**
 * Categorizza tutte le opinioni in favorevoli, indecisi e contrari
 */
export const categorizeOpinions = (
  userOpinions: Record<string, string>,
  opinionQuestions: OpinionQuestion[]
): CategorizedOpinions => {
  const favorevoli: ProfileOpinion[] = [];
  const indecisi: ProfileOpinion[] = [];
  const contrari: ProfileOpinion[] = [];
  
  // Ottieni tutte le chiavi delle opinioni
  const allOpinionKeys = Array.from(new Set([
    ...opinionQuestions.map(q => q.id),
    ...Object.keys(userOpinions)
  ]));
  
  allOpinionKeys.forEach((key) => {
    const value = userOpinions[key];
    if (!value) return;
    
    const question = opinionQuestions.find(q => q.id === key);
    const label = getOpinionTopic(key, question?.text || '');
    
    const opinion: ProfileOpinion = { id: key, label };
    
    if (value === "Favorevole") {
      favorevoli.push(opinion);
    } else if ((value === "Indeciso" || value === "Non lo so")) {
      indecisi.push(opinion);
    } else if (value === "Contrario") {
      contrari.push(opinion);
    }
  });
  
  return { favorevoli, indecisi, contrari };
};

/**
 * Estrae le opinioni base dal database
 */
export const extractBaseOpinions = (userData: any): Record<string, string> => {
  const userOpinionsData: Record<string, string> = {};
  
  const baseOpinions = ['energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa', 'caccia'];
  baseOpinions.forEach(opinion => {
    if (userData[opinion]) {
      userOpinionsData[opinion] = userData[opinion];
    }
  });
  
  return userOpinionsData;
};
