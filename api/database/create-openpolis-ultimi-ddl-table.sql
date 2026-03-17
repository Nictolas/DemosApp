-- Tabella per memorizzare gli ultimi DDL approvati (Camera e Senato) da Openpolis "Cosa succede"
-- Usata per mostrare titoli descrittivi nella pagina voti-parlamento

CREATE TABLE IF NOT EXISTS openpolis_ultimi_ddl_approvati (
  -- Camera o Senato
  camera VARCHAR(50) NOT NULL PRIMARY KEY CHECK (camera IN ('Camera', 'Senato')),

  -- Titolo completo del DDL (da pagina dettaglio Openpolis)
  titolo TEXT NOT NULL,

  -- Codice atto (es. C_2336, S_1670)
  codice_ddl VARCHAR(50) NOT NULL,

  -- URL pagina dettaglio Openpolis
  url_dettaglio TEXT NOT NULL,

  -- Data approvazione (se disponibile dalla pagina)
  data_approvazione DATE,

  -- Data/ora ultimo scraping
  data_scraping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Timestamp aggiornamento
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openpolis_ultimi_ddl_camera ON openpolis_ultimi_ddl_approvati(camera);
CREATE INDEX IF NOT EXISTS idx_openpolis_ultimi_ddl_data_scraping ON openpolis_ultimi_ddl_approvati(data_scraping DESC);

COMMENT ON TABLE openpolis_ultimi_ddl_approvati IS 'Ultimi DDL approvati per Camera e Senato, scrapati da Openpolis Cosa succede';
