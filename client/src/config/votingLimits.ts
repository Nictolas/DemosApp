/**
 * Configurazione limiti di voto per categoria
 * Questi limiti possono essere facilmente modificati in futuro
 */

export const VOTING_LIMITS = {
  // Opinioni proposte - limite ragionevole per iniziare
  opinioni_proposte: 5,
  
  // Capo di Stato - solo 1 voto
  capo_stato: 1,
  
  // Iniziative popolari - solo 1 voto per iniziative esistenti
  iniziative_popolari: 1,
  
  // Iniziative popolari proposte - solo 1 proposta
  iniziative_popolari_proposte: 1,
  
  // Referendum abrogativi - solo 1 voto
  referendum_abrogativi: 1,
  
  // Referendum abrogativi proposti - solo 1 proposta
  referendum_abrogativi_proposti: 1,
  
  // ICE - 1 voto per ICE (ma può votare più ICE)
  ice: 1,
  
  // ICE proposti - solo 1 proposta
  ice_proposti: 1,
  
  // Ministri - 1 voto per ministero (14 ministeri totali)
  ministri: 1,
  
  // Amnistia - solo 1 voto
  amnistia: 1,
  
  // Grazia - solo 1 carcerato
  grazia: 1,
  
  // Comunicazioni (like/dislike) - limite per evitare spam
  comunicazioni: 10
} as const;

export type VotingCategory = keyof typeof VOTING_LIMITS;

/**
 * Ottiene il limite di voto per una categoria
 */
export const getVotingLimit = (category: VotingCategory): number => {
  return VOTING_LIMITS[category];
};

/**
 * Verifica se un utente ha raggiunto il limite di voto per una categoria
 */
export const hasReachedVotingLimit = (
  category: VotingCategory, 
  currentVotes: number
): boolean => {
  return currentVotes >= getVotingLimit(category);
};

/**
 * Ottiene il numero di voti rimanenti per una categoria
 */
export const getRemainingVotes = (
  category: VotingCategory, 
  currentVotes: number
): number => {
  const limit = getVotingLimit(category);
  return Math.max(0, limit - currentVotes);
};
