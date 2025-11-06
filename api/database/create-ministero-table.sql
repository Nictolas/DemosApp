-- Tabella per iniziative e referendum dal Ministero della Giustizia
CREATE TABLE IF NOT EXISTS iniziative_ministero (
    id VARCHAR(255) PRIMARY KEY,
    id_ministero VARCHAR(255) UNIQUE,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    tipo VARCHAR(50) DEFAULT 'iniziativa',
    stato VARCHAR(50) DEFAULT 'in_corso',
    esito VARCHAR(100),
    
    -- Date
    data_inizio DATE,
    data_fine DATE,
    
    -- Sostenitori e quorum
    firme_raccolte INTEGER DEFAULT 0,
    quorum INTEGER DEFAULT 0,
    quorum_raggiunto BOOLEAN DEFAULT false,
    
    -- URL e link
    sito_web TEXT,
    documento TEXT,
    
    -- Metadati
    promotore TEXT,
    dati_raw JSONB,
    
    -- Timestamps
    data_ultimo_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_id_ministero ON iniziative_ministero(id_ministero);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_tipo ON iniziative_ministero(tipo);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_stato ON iniziative_ministero(stato);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_esito ON iniziative_ministero(esito);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_data_fine ON iniziative_ministero(data_fine);
CREATE INDEX IF NOT EXISTS idx_iniziative_ministero_quorum_raggiunto ON iniziative_ministero(quorum_raggiunto);

-- Commenti per documentazione
COMMENT ON TABLE iniziative_ministero IS 'Iniziative e referendum sincronizzati dal Ministero della Giustizia';
COMMENT ON COLUMN iniziative_ministero.id_ministero IS 'ID univoco dall\'API del Ministero';
COMMENT ON COLUMN iniziative_ministero.tipo IS 'Tipo: iniziativa, referendum, etc.';
COMMENT ON COLUMN iniziative_ministero.stato IS 'Stato: in_corso, conclusa, etc.';
COMMENT ON COLUMN iniziative_ministero.esito IS 'Esito dell\'iniziativa/referendum (compatibilità con tabelle legacy: In Attesa, Conclusa, etc.)';
COMMENT ON COLUMN iniziative_ministero.quorum_raggiunto IS 'Indica se il quorum è stato raggiunto';

