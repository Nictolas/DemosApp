# Proposta: Spiegazione Legge, Effetti Positivi e Negativi

## Obiettivo
Aggiungere al dialog delle votazioni parlamentari:
1. **Spiegazione generale** della specifica legge
2. **Effetti positivi** della legge
3. **Effetti negativi** della legge

## Analisi Dati Disponibili

### Dati Attuali
- **Titolo votazione**: Es. "Disegno di legge n. 1718. Votazione questione fiducia"
- **Descrizione**: Descrizione base dalla votazione
- **Numero legge**: Può essere estratto dal titolo (es. "1718")
- **Tipo atto**: DDL, Mozione, Decreto, ecc.
- **Camera**: Camera o Senato
- **Data votazione**: Data della seduta

### Limitazioni
- I dati SPARQL non contengono il testo completo della legge
- Non ci sono API pubbliche gratuite per il testo completo delle leggi italiane
- Normattiva e Gazzetta Ufficiale non hanno API pubbliche

## Soluzioni Proposte

### SOLUZIONE 1: Solo AI (Consigliata) ⭐

**Vantaggi:**
- ✅ Implementazione rapida
- ✅ Nessuna dipendenza esterna
- ✅ Funziona per tutte le votazioni
- ✅ Usa già Groq (gratuito) configurato

**Come funziona:**
1. Estrai numero legge dal titolo (regex: `n\.?\s*(\d+)`)
2. Genera 3 prompt AI separati:
   - **Spiegazione generale**: "Spiega in modo dettagliato questa legge italiana: [titolo + descrizione]"
   - **Effetti positivi**: "Elenca i principali effetti positivi di questa legge: [titolo + descrizione]"
   - **Effetti negativi**: "Elenca i principali effetti negativi o criticità di questa legge: [titolo + descrizione]"

**Implementazione:**
- Nuovo servizio: `services/leggeAnalysisService.js`
- Nuova tabella SQL: `parlamento_analisi_legge` (cache)
- Endpoint API: `/api/voti-politici/dettagli/:uri` (esteso)

**Costi:**
- Groq: Gratuito (già configurato)
- OpenAI: ~$0.01-0.02 per votazione (se usi OpenAI)

---

### SOLUZIONE 2: AI + Ricerca Web (Ibrida)

**Vantaggi:**
- ✅ Informazioni più accurate
- ✅ Aggiornamenti in tempo reale
- ✅ Fonti ufficiali

**Svantaggi:**
- ⚠️ Richiede web scraping (più complesso)
- ⚠️ Dipende da siti esterni (Normattiva, Gazzetta Ufficiale)
- ⚠️ Più lento

**Come funziona:**
1. Estrai numero legge dal titolo
2. Cerca su Normattiva/Gazzetta Ufficiale il testo della legge
3. Usa AI per analizzare il testo completo + generare effetti

**Fonti possibili:**
- Normattiva.it (web scraping)
- Gazzetta Ufficiale (web scraping)
- Openpolis (già usato, ma limitato)

**Implementazione:**
- Nuovo servizio: `services/leggeWebScraper.js`
- Integrazione con `leggeAnalysisService.js`

---

### SOLUZIONE 3: Solo Estrazione Dati (Limitata)

**Vantaggi:**
- ✅ Nessun costo AI
- ✅ Veloce

**Svantaggi:**
- ❌ Dati limitati (solo quello che c'è in SPARQL)
- ❌ Non può generare effetti positivi/negativi
- ❌ Spiegazione generica

**Come funziona:**
- Usa solo i dati disponibili in SPARQL
- Non genera contenuti nuovi

**Non consigliata** per questo caso d'uso.

---

## Raccomandazione: SOLUZIONE 1 (Solo AI)

### Perché?
1. **Già configurato**: Groq è già configurato nel progetto
2. **Gratuito**: Groq non ha costi
3. **Completo**: Genera spiegazione + effetti positivi + negativi
4. **Scalabile**: Funziona per tutte le votazioni
5. **Veloce**: ~2-3 secondi per generare tutto

### Struttura Database

```sql
CREATE TABLE IF NOT EXISTS parlamento_analisi_legge (
  id SERIAL PRIMARY KEY,
  uri_votazione TEXT NOT NULL UNIQUE,
  numero_legge TEXT, -- Estratto dal titolo (es. "1718")
  tipo_atto TEXT, -- DDL, Mozione, ecc.
  
  -- Contenuti generati
  spiegazione_generale TEXT, -- Spiegazione dettagliata della legge
  effetti_positivi TEXT, -- Lista effetti positivi (formato markdown o JSON)
  effetti_negativi TEXT, -- Lista effetti negativi (formato markdown o JSON)
  
  -- Metadati
  provider_ai VARCHAR(50), -- 'groq' o 'openai'
  modello_ai VARCHAR(100), -- Modello usato
  data_generazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indici
  CONSTRAINT fk_parlamento_analisi FOREIGN KEY (uri_votazione) 
    REFERENCES parlamento(uri) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_uri ON parlamento_analisi_legge(uri_votazione);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_numero_legge ON parlamento_analisi_legge(numero_legge);
```

### Struttura API Response

```json
{
  "success": true,
  "dettagli": {
    "titolo": "...",
    "descrizione": "...",
    "spiegazione": "...",
    "analisi_legge": {
      "spiegazione_generale": "Questa legge riguarda...",
      "effetti_positivi": [
        "Effetto positivo 1",
        "Effetto positivo 2"
      ],
      "effetti_negativi": [
        "Effetto negativo 1",
        "Effetto negativo 2"
      ],
      "data_generazione": "2026-01-13T10:00:00Z"
    }
  }
}
```

### Prompt AI Proposti

#### 1. Spiegazione Generale
```
Spiega in modo dettagliato e comprensibile (massimo 300 parole) questa legge italiana:

Titolo: "{titolo}"
Descrizione: "{descrizione}"
Numero legge: {numero_legge}
Tipo atto: {tipo_atto}
Camera: {camera}
Data votazione: {data_votazione}

La spiegazione deve:
- Essere in italiano
- Essere comprensibile per cittadini non esperti
- Spiegare cosa fa la legge in modo dettagliato
- Includere il contesto e gli obiettivi principali
- Essere neutrale e obiettiva
```

#### 2. Effetti Positivi
```
Elenca i principali effetti positivi o benefici di questa legge italiana (massimo 10 punti):

Titolo: "{titolo}"
Descrizione: "{descrizione}"
Numero legge: {numero_legge}

Rispondi in formato elenco puntato (markdown), con ogni punto su una riga separata.
Ogni punto deve essere chiaro e conciso (massimo 2 righe).
Se non ci sono effetti positivi evidenti, indica "Nessun effetto positivo identificabile".
```

#### 3. Effetti Negativi
```
Elenca i principali effetti negativi, criticità o potenziali problemi di questa legge italiana (massimo 10 punti):

Titolo: "{titolo}"
Descrizione: "{descrizione}"
Numero legge: {numero_legge}

Rispondi in formato elenco puntato (markdown), con ogni punto su una riga separata.
Ogni punto deve essere chiaro e conciso (massimo 2 righe).
Se non ci sono effetti negativi evidenti, indica "Nessun effetto negativo identificabile".
```

---

## Implementazione

### Step 1: Creare Tabella SQL
File: `create-parlamento-analisi-legge-table.sql`

### Step 2: Creare Servizio AI
File: `services/leggeAnalysisService.js`
- Funzione: `generaAnalisiLegge(uriVotazione, votazioneData)`
- Genera: spiegazione + effetti positivi + negativi
- Salva in cache nella tabella

### Step 3: Estendere Endpoint API
File: `routes/voti-politici.js`
- Endpoint `/api/voti-politici/dettagli/:uri` esteso
- Recupera o genera analisi legge
- Include nella response

### Step 4: Aggiornare Frontend
File: `client/src/pages/VotiParlamento.tsx`
- Aggiungere sezioni nel dialog:
  - "Spiegazione Generale"
  - "Effetti Positivi"
  - "Effetti Negativi"

---

## Alternative Future (Opzionali)

### Estensione: Ricerca Web
Se in futuro vuoi integrare ricerca web:
1. Web scraping Normattiva per testo completo legge
2. Passa testo completo all'AI per analisi più accurata
3. Mantieni cache per evitare scraping ripetuto

### Estensione: Fonti Esterne
- Integrazione con API Openpolis (se disponibile)
- Integrazione con dataset pubblici governo italiano

---

## Domande per l'Utente

1. **Preferisci SOLUZIONE 1 (Solo AI)** o **SOLUZIONE 2 (AI + Web)**?
2. **Formato effetti**: Elenco puntato semplice o JSON strutturato?
3. **Cache**: Vuoi che l'analisi venga generata una volta e poi cachata, o rigenerata ogni volta?
4. **Fallback**: Cosa mostrare se l'AI non riesce a generare l'analisi?
