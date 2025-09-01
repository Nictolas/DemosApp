// Colonne da escludere dalla visualizzazione
export const HIDDEN_COLUMNS = [
  // Colonne delle opinioni
  'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
  'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
  'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia',
  // Colonne specifiche da nascondere
  'id', 'nome', 'cognome', 'password_hash', 'avatar_config', 'fonti_opinioni', 'firestore_uid'
];

// Colonne forzate per candidatura ed elezione
export const FORCED_COLUMNS = [
  'candidato_attivo', 'status_candidatura', 'grado_candidatura',
  'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
  'data_candidatura', 'note_candidatura',
  'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione'
];

// Colonne con priorità di ordinamento
export const PRIORITY_COLUMNS = [
  'nome_completo', 'email', 'ruolo', 'status',
  // Colonne candidatura (priorità alta)
  'candidato_attivo', 'status_candidatura', 'grado_candidatura',
  'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
  'data_candidatura', 'note_candidatura',
  // Colonne elezione (priorità alta)
  'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione'
];

export const USERS_PER_PAGE = 20;
