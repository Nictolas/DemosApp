-- Tabella per memorizzare le ultime votazioni finali decisive (Openpolis)
-- Lista: /votazioni?main_vote_type=is_final — Dettaglio: /votazioni/vs19_xxx o /votazioni/19-xxx-x

CREATE TABLE IF NOT EXISTS openpolis_votazioni_finali_decisive (
  id SERIAL PRIMARY KEY,

  -- Identificativo Openpolis (slug URL: vs19_604_001 per Camera, 19-383-3 per Senato)
  openpolis_id VARCHAR(50) NOT NULL UNIQUE,

  -- Camera o Senato
  camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),

  -- Titolo della votazione (es. "DDL 2336-A E ABB - VOTO FINALE")
  titolo TEXT NOT NULL,

  -- URL pagina dettaglio Openpolis
  url_dettaglio TEXT NOT NULL,

  -- Esito: Approvata | Respinta
  esito VARCHAR(20) NOT NULL CHECK (esito IN ('Approvata', 'Respinta')),

  -- Data votazione (da "Seduta n. 604 del 29/01/2026")
  data_votazione DATE,

  -- Data/ora ultimo scraping
  data_scraping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_camera ON openpolis_votazioni_finali_decisive(camera);
CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_data_votazione ON openpolis_votazioni_finali_decisive(data_votazione DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_data_scraping ON openpolis_votazioni_finali_decisive(data_scraping DESC);

COMMENT ON TABLE openpolis_votazioni_finali_decisive IS 'Votazioni finali decisive (Approvata/Respinta) da Openpolis, filtro main_vote_type=is_final';
