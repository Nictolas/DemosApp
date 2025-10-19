// Colonne da escludere dalla visualizzazione
export const HIDDEN_COLUMNS = [
  // Colonne delle opinioni
  'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
  'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
  'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia',
  // Colonne specifiche da nascondere
  'id', 'nome', 'cognome', 'name', 'password_hash', 'avatar_config', 'fonti_opinioni',
  'created_at', 'updated_at',
  // Colonne di candidatura ed elezione (nascoste perché non necessarie per la gestione utenti)
  'candidato_attivo', 'status_candidatura', 'paese_candidatura', 'regione_candidatura', 
  'provincia_candidatura', 'comune_candidatura', 'data_candidatura', 'note_candidatura',
  'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione'
];

// Colonne forzate per candidatura ed elezione
export const FORCED_COLUMNS = [
  'grado_candidatura', 'grado_elezione'
];

// Colonne con priorità di ordinamento
export const PRIORITY_COLUMNS = [
  'avatar', 'nome_completo', 'email', 'ruolo', 'status', 'grado_candidatura', 'grado_elezione'
];

export const USERS_PER_PAGE = 20;
