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

// Colonne con priorità per l'ordinamento
export const PRIORITY_COLUMNS = [
  'nome_completo', 'email', 'ruolo', 'status',
  // Colonne candidatura (priorità alta)
  'candidato_attivo', 'status_candidatura', 'grado_candidatura',
  'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
  'data_candidatura', 'note_candidatura',
  // Colonne elezione (priorità alta)
  'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione'
];

// Configurazione paginazione
export const USERS_PER_PAGE = 20;

// Configurazione query
export const QUERY_CONFIG = {
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  refetchOnReconnect: true,
  staleTime: 0,
  gcTime: 5 * 60 * 1000, // 5 minuti
  refetchInterval: 30 * 1000, // 30 secondi
  refetchIntervalInBackground: false
};

// Mappatura colori per ruoli
export const ROLE_COLORS = {
  'politico': 'bg-red-100 text-red-800 border-red-200',
  'candidato': 'bg-blue-100 text-blue-800 border-blue-200',
  'candidato politico': 'bg-purple-100 text-purple-800 border-purple-200',
  'admin': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'default': 'bg-gray-100 text-gray-800 border-gray-200'
};

// Mappatura colori per genere
export const GENDER_COLORS = {
  'uomo': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'donna': 'bg-pink-100 text-pink-800 border-pink-200',
  'altro': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'default': 'bg-gray-100 text-gray-800 border-gray-200'
};

// Mappatura colori per status candidatura
export const CANDIDACY_STATUS_COLORS = {
  'attiva': 'bg-blue-100 text-blue-800 border-blue-200',
  'in_attesa': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'approvata': 'bg-green-100 text-green-800 border-green-200',
  'rifiutata': 'bg-red-100 text-red-800 border-red-200',
  'default': 'bg-gray-100 text-gray-800 border-gray-200'
};

// Mappatura nomi colonne per la visualizzazione
export const COLUMN_NAMES = {
  'nome_completo': 'Nome Completo',
  'email': 'Email',
  'ruolo': 'Ruolo',
  'status': 'Status',
  'created_at': 'Data Creazione',
  'data_nascita': 'Data Nascita',
  'genere': 'Genere',
  'cittadinanza': 'Cittadinanza',
  'regione': 'Regione',
  'provincia': 'Provincia',
  'comune': 'Comune',
  'paese': 'Paese',
  'telefono': 'Telefono',
  'professione': 'Professione',
  'istruzione': 'Istruzione',
  'reddito': 'Reddito',
  'partito': 'Partito',
  'is_admin': 'Admin',
  'is_premium': 'Premium',
  'premium': 'Premium',
  'avatar_url': 'Avatar',
  'bio': 'Biografia',
  'social_links': 'Social',
  'preferenze_notifiche': 'Notifiche',
  'notifiche_preferenze': 'Notifiche',
  // Colonne candidatura
  'candidato_attivo': 'Candidato Attivo',
  'status_candidatura': 'Status Candidatura',
  'grado_candidatura': 'Grado Candidatura',
  'paese_candidatura': 'Paese Candidatura',
  'regione_candidatura': 'Regione Candidatura',
  'provincia_candidatura': 'Provincia Candidatura',
  'comune_candidatura': 'Comune Candidatura',
  'data_candidatura': 'Data Candidatura',
  'note_candidatura': 'Note Candidatura',
  // Colonne elezione
  'grado_elezione': 'Grado Elezione',
  'paese_elezione': 'Paese Elezione',
  'regione_elezione': 'Regione Elezione',
  'provincia_elezione': 'Provincia Elezione',
  'comune_elezione': 'Comune Elezione',
  // Altre colonne
  'approved_at': 'Data Approvazione',
  'ultimo_accesso': 'Ultimo Accesso',
  'data_registrazione': 'Data Registrazione',
  'sesso': 'Sesso',
  'indirizzo': 'Indirizzo',
  'name': 'Nome Completo'
};
