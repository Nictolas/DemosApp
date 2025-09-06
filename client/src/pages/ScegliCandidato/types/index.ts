export interface Candidato {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: string;
  avatar_config?: string;
  grado_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;
  grado_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
  // Opinion nazionali/europee
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  eutanasia?: string;
  carne_coltivata?: string;
  cittadina_animale?: string;
  nato?: string;
  matrimonio_gay?: string;
  salario_minimo?: string;
  case_chiuse?: string;
  omobitransfobia?: string;
  // Opinion comunali
  cassonetti_intelligenti_con_tessera?: string;
  concessione_spazi_pubblici_a_centri_sociali_autogestiti?: string;
  divieto_di_nuovi_fast_food_nel_centro_storico?: string;
  estensione_delle_zone_a_traffico_limitato?: string;
  finanziamento_eventi_culturali_gratuiti?: string;
  nuova_biblioteca_comunale?: string;
  nuove_case_popolari?: string;
  nuove_piste_ciclabili?: string;
  nuovi_asili_nido_comunali?: string;
  nuovo_stadio_comunale?: string;
  parcheggi_gratuiti_per_residenti?: string;
  potenziamento_trasporto_pubblico?: string;
  riduzione_tasse_rifiuti?: string;
  sicurezza_strade_scolastiche?: string;
  sostegno_commercio_locale?: string;
  verde_pubblico_e_giardini?: string;
  // Opinion regionali
  nuovi_inceneritori?: string;
  chiusura_ospedali_di_provincia?: string;
  // Opinion nazionali/comunali
  raccolta_rifiuti_porta_a_porta?: string;
  riduzione_dell_illuminazione_notturna_per_risparmio_energetico?: string;
  sussidi_comunali_per_famiglie_numerose?: string;
  videosorveglianza_in_spazi_pubblici?: string;
  riduzione_parcheggi_a_pagamento?: string;
}

export interface OpinioniDialogData {
  utenteId: string;
  nome: string;
  cognome: string;
  avatarConfig?: string;
}

export interface ScegliCandidatoState {
  selezionando: boolean;
  opinioniDialogData: OpinioniDialogData | null;
}

export interface CandidatoCardProps {
  candidato: Candidato;
  isSelected: boolean;
  isSelezionando: boolean;
  onSeleziona: (candidatoId: string) => void;
  onViewOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
}
