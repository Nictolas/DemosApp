/**
 * Mirrors the category order used by api/routes/iniziative-popolari.js.
 * Profile selections are stored as titles, so this function deliberately works
 * without another network request (including when the encrypted cache is used).
 */
const emojiCategories: ReadonlyArray<readonly [readonly string[], string]> = [
  [['educazione', 'scuola', 'istruzione', 'studenti', 'docenti', 'curriculum', 'materia'], '📚'],
  [['ambiente', 'clima', 'energia', 'rinnovabile', 'sostenibilità', 'ecologia', 'inquinamento'], '🌱'],
  [['sanità', 'salute', 'ospedale', 'cure', 'medico', 'farmaco', 'igiene', 'femminile'], '🏥'],
  [['diritti', 'uguaglianza', 'discriminazione', 'parità', 'genere', 'lgbt', 'matrimonio'], '🤝'],
  [['lavoro', 'economia', 'iva', 'tasse', 'fiscale', 'occupazione', 'salario'], '💼'],
  [['nucleare', 'energia nucleare', 'reattore', 'fissione'], '⚛️'],
  [['giustizia', 'legge', 'penale', 'carcere', 'reato', 'criminale'], '⚖️'],
  [['cultura', 'arte', 'patrimonio', 'museo', 'teatro'], '🎭'],
  [['trasporti', 'mobilità', 'auto', 'strada', 'traffico'], '🚗'],
  [['tecnologia', 'digitale', 'internet', 'informatica', 'software'], '💻'],
  [['famiglia', 'bambini', 'infanzia', 'prima infanzia', 'maternità'], '👨‍👩‍👧‍👦'],
  [['animali', 'cane', 'gatto', 'pet', 'sperimentazione animale'], '🐕'],
  [['sport', 'calcio', 'atletica', 'olimpico'], '⚽'],
  [['cibo', 'agricoltura', 'alimentare', 'produzione'], '🌾'],
  [['casa', 'abitazione', 'edilizia', 'alloggio'], '🏠'],
  [['sicurezza', 'polizia', 'protezione', 'difesa'], '🛡️'],
  [['democrazia', 'politica', 'elezioni', 'voto', 'referendum'], '🗳️'],
];

export function getInitiativeChoiceEmoji(title: string): string {
  const normalized = title.toLowerCase();
  return emojiCategories.find(([keywords]) => keywords.some(keyword => normalized.includes(keyword)))?.[1] ?? '📋';
}
