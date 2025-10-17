// Colonne da escludere dalla visualizzazione
export const HIDDEN_COLUMNS = [
  // Colonne delle opinioni (manteniamo nascoste per non sovraccaricare la tabella)
  'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
  'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
  'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia',
  // Colonne tecniche da nascondere
  'id', 'password_hash', 'avatar_config', 'fonti_opinioni', 'firestore_uid',
  'created_at', 'updated_at', 'reset_token', 'reset_token_expires', 'email_verification_token',
  // Colonne di opinioni locali (troppo specifiche)
  'cassonetti_intelligenti_con_tessera', 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
  'divieto_di_nuovi_fast_food_nel_centro_storico', 'estensione_delle_zone_a_traffico_limitato',
  'finanziamento_eventi_culturali_gratuiti', 'nuova_biblioteca_comunale', 'nuove_case_popolari',
  'nuove_piste_ciclabili', 'nuovi_asili_nido_comunali', 'nuovo_stadio_comunale',
  'parcheggi_gratuiti_per_residenti', 'potenziamento_trasporto_pubblico', 'riduzione_tasse_rifiuti',
  'sicurezza_strade_scolastiche', 'sostegno_commercio_locale', 'verde_pubblico_e_giardini',
  'nuovi_inceneritori', 'chiusura_ospedali_di_provincia', 'raccolta_rifiuti_porta_a_porta',
  'riduzione_dell_illuminazione_notturna_per_risparmio_energetico', 'sussidi_comunali_per_famiglie_numerose',
  'videosorveglianza_in_spazi_pubblici', 'riduzione_parcheggi_a_pagamento',
  // Colonne di candidatura ed elezione (manteniamo nascoste per non sovraccaricare)
  'candidato_attivo', 'status_candidatura', 'paese_candidatura', 'regione_candidatura', 
  'provincia_candidatura', 'comune_candidatura', 'data_candidatura', 'note_candidatura',
  'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
  // Colonne rappresentanti e candidati (troppo specifiche)
  'rappresentante_europeo', 'rappresentante_camera', 'rappresentante_senato',
  'rappresentante_regionale', 'rappresentante_comune', 'candidato_europeo',
  'candidato_camera', 'candidato_senato', 'candidato_regionale', 'candidato_comune'
];

// Colonne forzate per candidatura ed elezione
export const FORCED_COLUMNS = [
  'grado_candidatura', 'grado_elezione'
];

// Colonne con priorità di ordinamento
export const PRIORITY_COLUMNS = [
  'avatar', 'nome_completo', 'email', 'ruolo', 'status', 
  'data_nascita', 'genere', 'cittadinanza', 'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
  'verified', 'auth_method', 'premium', 'is_premium', 'is_admin',
  'privacy_policy_consent', 'terms_of_service_consent', 'cookie_policy_consent',
  'profile_visibility', 'opinions_public', 'email_notifications', 'push_notifications',
  'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url', 'website_url',
  'grado_candidatura', 'grado_elezione'
];

export const USERS_PER_PAGE = 20;
