# 📊 Analisi Spazio Occupato per Singolo Utente

## Metodologia di Calcolo

Questa analisi calcola lo spazio occupato da un singolo utente considerando:
1. **Tabella `users`** (1 riga per utente)
2. **Tutte le tabelle correlate** dove l'utente può inserire dati
3. **Overhead PostgreSQL** (24 bytes per riga + indici)
4. **Stime realistiche** basate su utilizzo tipico

---

## 1. TABELLA `users` (Riga Base Utente)

### Schema Completo (basato su `recreate-complete-schema.cjs`)

| Campo | Tipo | Dimensione Media | Spazio (bytes) |
|-------|------|------------------|----------------|
| `id` | VARCHAR(255) | 36 chars (UUID) | 36 + 1 = 37 |
| `email` | VARCHAR(255) | 30 chars | 30 + 1 = 31 |
| `nome` | VARCHAR(255) | 15 chars | 15 + 1 = 16 |
| `cognome` | VARCHAR(255) | 20 chars | 20 + 1 = 21 |
| `data_nascita` | DATE | 4 bytes | 4 |
| `sesso` | VARCHAR(20) | 6 chars | 6 + 1 = 7 |
| `genere` | VARCHAR(20) | 6 chars | 6 + 1 = 7 |
| `paese` | VARCHAR(100) | 5 chars | 5 + 1 = 6 |
| `paese_residenza` | VARCHAR(100) | 5 chars | 5 + 1 = 6 |
| `regione` | VARCHAR(100) | 12 chars | 12 + 1 = 13 |
| `regione_residenza` | VARCHAR(100) | 12 chars | 12 + 1 = 13 |
| `provincia` | VARCHAR(100) | 15 chars | 15 + 1 = 16 |
| `provincia_residenza` | VARCHAR(100) | 15 chars | 15 + 1 = 16 |
| `comune` | VARCHAR(100) | 12 chars | 12 + 1 = 13 |
| `comune_residenza` | VARCHAR(100) | 12 chars | 12 + 1 = 13 |
| `indirizzo` | TEXT | 50 chars | 50 + 4 = 54 |
| `telefono` | VARCHAR(50) | 10 chars | 10 + 1 = 11 |
| `professione` | VARCHAR(100) | 20 chars | 20 + 1 = 21 |
| `istruzione` | VARCHAR(100) | 15 chars | 15 + 1 = 16 |
| `reddito` | VARCHAR(50) | 10 chars | 10 + 1 = 11 |
| `partito` | VARCHAR(100) | 20 chars | 20 + 1 = 21 |
| `is_admin` | BOOLEAN | 1 byte | 1 |
| `is_premium` | BOOLEAN | 1 byte | 1 |
| `premium` | BOOLEAN | 1 byte | 1 |
| `data_registrazione` | TIMESTAMP | 8 bytes | 8 |
| `ultimo_accesso` | TIMESTAMP | 8 bytes | 8 |
| `avatar_url` | TEXT | 100 chars | 100 + 4 = 104 |
| `bio` | TEXT | 200 chars | 200 + 4 = 204 |
| `social_links` | JSONB | 150 bytes | 150 |
| `preferenze_notifiche` | JSONB | 100 bytes | 100 |
| `notifiche_preferenze` | JSONB | 100 bytes | 100 |
| `avatar_config` | JSONB | 200 bytes | 200 |
| `fcm_tokens` | TEXT[] | 2 tokens × 200 chars | 400 + 24 = 424 |
| `paese_candidatura` | VARCHAR(100) | NULL | 0 |
| `regione_candidatura` | VARCHAR(100) | NULL | 0 |
| `provincia_candidatura` | VARCHAR(100) | NULL | 0 |
| `comune_candidatura` | VARCHAR(100) | NULL | 0 |
| `candidato_attivo` | BOOLEAN | 1 byte | 1 |
| `data_candidatura` | TIMESTAMP | NULL | 0 |
| `status_candidatura` | VARCHAR(50) | NULL | 0 |
| `note_candidatura` | TEXT | NULL | 0 |
| `cittadinanza` | VARCHAR(100) | 5 chars | 5 + 1 = 6 |
| `comune_elezione` | VARCHAR(100) | 12 chars | 12 + 1 = 13 |
| `grado_elezione` | VARCHAR(100) | 10 chars | 10 + 1 = 11 |
| `paese_elezione` | VARCHAR(100) | 5 chars | 5 + 1 = 6 |
| `grado_candidatura` | VARCHAR(100) | NULL | 0 |
| `ruolo` | VARCHAR(100) | 2 chars ('US') | 2 + 1 = 3 |
| `carne_coltivata` | BOOLEAN | 1 byte | 1 |
| `cittadina_animale` | BOOLEAN | 1 byte | 1 |
| `sperimentazione_animale` | BOOLEAN | 1 byte | 1 |
| `caccia` | BOOLEAN | 1 byte | 1 |
| `eutanasia` | BOOLEAN | 1 byte | 1 |
| `case_chiuse` | BOOLEAN | 1 byte | 1 |
| `salario_minimo` | BOOLEAN | 1 byte | 1 |
| `matrimonio_gay` | BOOLEAN | 1 byte | 1 |
| `legalizzazione_canapa` | BOOLEAN | 1 byte | 1 |
| `energia_nucleare` | BOOLEAN | 1 byte | 1 |
| `nato` | BOOLEAN | 1 byte | 1 |
| `omobitransfobia` | BOOLEAN | 1 byte | 1 |
| `approved_at` | TIMESTAMP | 8 bytes | 8 |
| `status` | VARCHAR(20) | 8 chars ('approved') | 8 + 1 = 9 |
| `uid` | VARCHAR(255) | NULL | 0 |
| `created_at` | TIMESTAMP | 8 bytes | 8 |
| `updated_at` | TIMESTAMP | 8 bytes | 8 |
| `password_hash` | VARCHAR(255) | 60 chars (bcrypt) | 60 + 1 = 61 |
| `email_verified` | BOOLEAN | 1 byte | 1 |
| `verification_token` | VARCHAR(255) | NULL | 0 |
| `reset_password_token` | VARCHAR(255) | NULL | 0 |
| `reset_password_expires` | TIMESTAMP | NULL | 0 |

**TOTALE TABELLA `users`**: ~2,100 bytes = **2.05 KB**

**Con overhead PostgreSQL (24 bytes per riga + indici ~100 bytes)**: **~2.2 KB**

---

## 2. TABELLE VOTI

### 2.1 `voti_capo_stato`

**Stima**: 1 voto ogni 5 anni (elezione capo stato)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `candidato_id` | VARCHAR(255) | 36 chars | 37 |
| `elezione_id` | VARCHAR(255) | 36 chars | 37 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `voto` | BOOLEAN | 1 byte | 1 |
| `note` | TEXT | 50 chars | 54 |
| `ip_address` | VARCHAR(45) | 15 chars | 16 |
| `user_agent` | TEXT | 100 chars | 104 |
| `nome` | TEXT | 30 chars | 34 |
| `userid` | VARCHAR(255) | 36 chars | 37 |
| `timestamp` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~409 bytes + 24 overhead = **433 bytes**

**Per utente (1 voto/5 anni)**: **433 bytes**

---

### 2.2 `voti_ministri`

**Stima**: 15 voti (uno per ministro del governo attuale)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `categoria` | VARCHAR(100) | 20 chars | 21 |
| `nome_ministro` | VARCHAR(255) | 30 chars | 31 |
| `nome_display` | VARCHAR(255) | 30 chars | 31 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `note` | TEXT | 50 chars | 54 |
| `userId` | VARCHAR(255) | 36 chars | 37 |
| `timestamp` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~263 bytes + 24 overhead = **287 bytes**

**Per utente (15 voti)**: 287 × 15 = **4.3 KB**

---

### 2.3 `voti_amnistia`

**Stima**: 2 voti (amnistie rare)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `legge` | TEXT | 100 chars | 104 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `note` | TEXT | 50 chars | 54 |
| `userId` | VARCHAR(255) | 36 chars | 37 |
| `timestamp` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~284 bytes + 24 overhead = **308 bytes**

**Per utente (2 voti)**: 308 × 2 = **616 bytes**

---

### 2.4 `voti_grazia`

**Stima**: 1 voto (richieste grazia rare)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `nome` | TEXT | 50 chars | 54 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `note` | TEXT | 50 chars | 54 |
| `userId` | VARCHAR(255) | 36 chars | 37 |
| `timestamp` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~234 bytes + 24 overhead = **258 bytes**

**Per utente (1 voto)**: **258 bytes**

---

### 2.5 `voti_iniziative_popolari`

**Stima**: 5 voti (iniziative popolari attive)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `iniziativa_id` | VARCHAR(255) | 36 chars | 37 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `voto` | BOOLEAN | 1 byte | 1 |
| `note` | TEXT | 50 chars | 54 |
| `ip_address` | VARCHAR(45) | 15 chars | 16 |
| `user_agent` | TEXT | 100 chars | 104 |
| `iniziativaId` | VARCHAR(255) | 36 chars | 37 |
| `userId` | VARCHAR(255) | 36 chars | 37 |
| `timestamp` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~377 bytes + 24 overhead = **401 bytes**

**Per utente (5 voti)**: 401 × 5 = **2.0 KB**

---

### 2.6 `voti_referendum_abrogativi`

**Stima**: 3 voti (referendum abrogativi)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `referendum_id` | VARCHAR(255) | 36 chars | 37 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `voto` | BOOLEAN | 1 byte | 1 |
| `note` | TEXT | 50 chars | 54 |
| `ip_address` | VARCHAR(45) | 15 chars | 16 |
| `user_agent` | TEXT | 100 chars | 104 |
| `userId` | VARCHAR(255) | 36 chars | 37 |
| `referendumId` | VARCHAR(255) | 36 chars | 37 |
| `timestamp` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~365 bytes + 24 overhead = **389 bytes**

**Per utente (3 voti)**: 389 × 3 = **1.17 KB**

---

### 2.7 `voti_ice`

**Stima**: 2 voti (ICE - Iniziative Cittadini Europei)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `ice_id` | VARCHAR(255) | 36 chars | 37 |
| `data_voto` | TIMESTAMP | 8 bytes | 8 |
| `voto` | BOOLEAN | 1 byte | 1 |
| `note` | TEXT | 50 chars | 54 |
| `ip_address` | VARCHAR(45) | 15 chars | 16 |
| `user_agent` | TEXT | 100 chars | 104 |

**Per riga**: ~293 bytes + 24 overhead = **317 bytes**

**Per utente (2 voti)**: 317 × 2 = **634 bytes**

---

**TOTALE TABELLE VOTI**: 
- voti_capo_stato: 433 bytes
- voti_ministri: 4.3 KB
- voti_amnistia: 616 bytes
- voti_grazia: 258 bytes
- voti_iniziative_popolari: 2.0 KB
- voti_referendum_abrogativi: 1.17 KB
- voti_ice: 634 bytes

**TOTALE**: **~9.4 KB**

---

## 3. TABELLA `opinioni_proposte`

**Stima**: 2 opinioni proposte (utente attivo)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `titolo` | TEXT | 100 chars | 104 |
| `descrizione` | TEXT | 500 chars | 504 |
| `testo` | TEXT | 1000 chars | 1004 |
| `categoria` | VARCHAR(100) | 20 chars | 21 |
| `fonte` | VARCHAR(100) | 10 chars | 11 |
| `data_proposta` | TIMESTAMP | 8 bytes | 8 |
| `status` | VARCHAR(50) | 12 chars | 13 |
| `tags` | TEXT[] | 5 tags × 20 chars | 100 + 24 = 124 |
| `immagine_url` | TEXT | 100 chars | 104 |
| `fonte_url` | TEXT | 100 chars | 104 |
| `autore_fonte` | VARCHAR(255) | 30 chars | 31 |
| `data_fonte` | TIMESTAMP | 8 bytes | 8 |
| `rilevanza` | INTEGER | 4 bytes | 4 |
| `complessita` | INTEGER | 4 bytes | 4 |
| `controversia` | INTEGER | 4 bytes | 4 |
| `note_revisione` | TEXT | NULL | 0 |
| `revisore_id` | VARCHAR(255) | NULL | 0 |
| `data_revisione` | TIMESTAMP | NULL | 0 |
| `proponente` | TEXT | 30 chars | 34 |
| `proponente_email` | TEXT | 30 chars | 34 |
| `voti` | INTEGER | 4 bytes | 4 |
| `votanti` | TEXT[] | 10 votanti × 36 chars | 360 + 24 = 384 |
| `created_at` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~2,485 bytes + 24 overhead = **2.5 KB**

**Per utente (2 opinioni)**: 2.5 × 2 = **5.0 KB**

---

## 4. TABELLA `comunicazioni`

**Stima**: 10 comunicazioni (come mittente o destinatario)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `mittente_id` | VARCHAR(255) | 36 chars | 37 |
| `destinatario_id` | VARCHAR(255) | 36 chars | 37 |
| `oggetto` | TEXT | 50 chars | 54 |
| `messaggio` | TEXT | 500 chars | 504 |
| `data_invio` | TIMESTAMP | 8 bytes | 8 |
| `data_lettura` | TIMESTAMP | 8 bytes | 8 |
| `status` | VARCHAR(50) | 8 chars | 9 |
| `tipo` | VARCHAR(50) | 10 chars | 11 |
| `allegati` | JSONB | NULL | 0 |
| `priorita` | VARCHAR(20) | 7 chars | 8 |

**Per riga**: ~724 bytes + 24 overhead = **748 bytes**

**Per utente (10 comunicazioni)**: 748 × 10 = **7.5 KB**

---

## 5. TABELLA `notifiche_utente`

**Stima**: 50 notifiche (accumulate nel tempo)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `tipo` | VARCHAR(50) | 15 chars | 16 |
| `titolo` | TEXT | 50 chars | 54 |
| `message` | TEXT | 200 chars | 204 |
| `messaggio` | TEXT | 200 chars | 204 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |
| `data_lettura` | TIMESTAMP | 8 bytes | 8 |
| `status` | VARCHAR(50) | 9 chars | 10 |
| `priorita` | VARCHAR(20) | 7 chars | 8 |
| `created_at` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~594 bytes + 24 overhead = **618 bytes**

**Per utente (50 notifiche)**: 618 × 50 = **30.9 KB**

---

## 6. TABELLA `admin_notifications`

**Stima**: 5 notifiche admin (per utente admin o destinatario)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `tipo` | VARCHAR(50) | 15 chars | 16 |
| `titolo` | TEXT | 50 chars | 54 |
| `title` | TEXT | 50 chars | 54 |
| `messaggio` | TEXT | 200 chars | 204 |
| `message` | TEXT | 200 chars | 204 |
| `destinatario_id` | VARCHAR(255) | 36 chars | 37 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |
| `data_lettura` | TIMESTAMP | 8 bytes | 8 |
| `status` | VARCHAR(50) | 9 chars | 10 |
| `priorita` | VARCHAR(20) | 7 chars | 8 |
| `azioni` | JSONB | 100 bytes | 100 |
| `metadata` | JSONB | 100 bytes | 100 |
| `type` | VARCHAR(50) | 15 chars | 16 |
| `userData` | JSONB | 150 bytes | 150 |
| `createdAt` | TIMESTAMP | 8 bytes | 8 |
| `read` | BOOLEAN | 1 byte | 1 |
| `updatedAt` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~1,022 bytes + 24 overhead = **1.05 KB**

**Per utente (5 notifiche)**: 1.05 × 5 = **5.25 KB**

---

## 7. TABELLA `reazioni`

**Stima**: 20 reazioni (like/dislike a comunicazioni)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `comunicazione_id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `tipo` | VARCHAR(20) | 4 chars | 5 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |
| `data_aggiornamento` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~131 bytes + 24 overhead = **155 bytes**

**Per utente (20 reazioni)**: 155 × 20 = **3.1 KB**

---

## 8. TABELLA `programmi`

**Stima**: 1 programma (se candidato)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `proposta_1` | TEXT | 500 chars | 504 |
| `proposta_2` | TEXT | 500 chars | 504 |
| `proposta_3` | TEXT | 500 chars | 504 |
| `proposta_4` | TEXT | 500 chars | 504 |
| `proposta_5` | TEXT | 500 chars | 504 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |
| `data_modifica` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~2,611 bytes + 24 overhead = **2.6 KB**

**Per utente (1 programma, solo per candidati ~5%)**: 2.6 × 0.05 = **0.13 KB**

---

## 9. TABELLA `richieste_premium`

**Stima**: 0.1 richieste (10% degli utenti)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `tipo_richiesta` | VARCHAR(50) | 7 chars | 8 |
| `data_richiesta` | TIMESTAMP | 8 bytes | 8 |
| `status` | VARCHAR(50) | 9 chars | 10 |
| `motivazione` | TEXT | 200 chars | 204 |
| `documenti_url` | JSONB | 150 bytes | 150 |
| `note_admin` | TEXT | 100 chars | 104 |
| `data_approvazione` | TIMESTAMP | 8 bytes | 8 |
| `approvatore_id` | VARCHAR(255) | 36 chars | 37 |

**Per riga**: ~612 bytes + 24 overhead = **636 bytes**

**Per utente (0.1 richieste)**: 636 × 0.1 = **64 bytes**

---

## 10. TABELLA `richieste_grazia`

**Stima**: 0.01 richieste (1% degli utenti)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `nome` | TEXT | 50 chars | 54 |
| `url_prova` | TEXT | 100 chars | 104 |
| `status` | VARCHAR(50) | 7 chars | 8 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |
| `note` | TEXT | 100 chars | 104 |

**Per riga**: ~321 bytes + 24 overhead = **345 bytes**

**Per utente (0.01 richieste)**: 345 × 0.01 = **3.5 bytes**

---

## 11. TABELLE INIZIATIVE (come promotore)

### 11.1 `iniziative_popolari`

**Stima**: 0.1 iniziative (10% degli utenti attivi)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `titolo` | TEXT | 100 chars | 104 |
| `descrizione` | TEXT | 1000 chars | 1004 |
| `promotore_id` | VARCHAR(255) | 36 chars | 37 |
| `userid` | VARCHAR(255) | 36 chars | 37 |
| `nome` | TEXT | 30 chars | 34 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |
| `data_scadenza` | TIMESTAMP | 8 bytes | 8 |
| `dataInizio` | DATE | 4 bytes | 4 |
| `dataFine` | DATE | 4 bytes | 4 |
| `quorum` | INTEGER | 4 bytes | 4 |
| `status` | VARCHAR(50) | 6 chars | 7 |
| `firme_raccolte` | INTEGER | 4 bytes | 4 |
| `firme_necessarie` | INTEGER | 4 bytes | 4 |
| `categoria` | VARCHAR(100) | 20 chars | 21 |
| `tags` | TEXT[] | 5 tags × 20 chars | 100 + 24 = 124 |
| `documento_url` | TEXT | 100 chars | 104 |
| `immagine_url` | TEXT | 100 chars | 104 |
| `note` | TEXT | 200 chars | 204 |
| `sitoWeb` | TEXT | 50 chars | 54 |
| `createdAt` | TIMESTAMP | 8 bytes | 8 |
| `updatedAt` | TIMESTAMP | 8 bytes | 8 |
| `acceptedAt` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~1,848 bytes + 24 overhead = **1.87 KB**

**Per utente (0.1 iniziative)**: 1.87 × 0.1 = **0.19 KB**

---

### 11.2 `referendum_abrogativi`

**Stima**: 0.05 referendum (5% degli utenti attivi)

**Per riga**: ~1.87 KB (simile a iniziative)

**Per utente (0.05 referendum)**: 1.87 × 0.05 = **0.09 KB**

---

### 11.3 `ice`

**Stima**: 0.01 ICE (1% degli utenti attivi)

**Per riga**: ~1.87 KB (simile)

**Per utente (0.01 ICE)**: 1.87 × 0.01 = **0.02 KB**

---

## 12. TABELLA `sostenitori` (se esiste)

**Stima**: 5 sostenitori (rappresentanti/candidati seguiti)

| Campo | Tipo | Dimensione | Spazio |
|-------|------|------------|--------|
| `id` | VARCHAR(255) | 36 chars | 37 |
| `utente_id` | VARCHAR(255) | 36 chars | 37 |
| `rappresentante_id` | VARCHAR(255) | 36 chars | 37 |
| `data_creazione` | TIMESTAMP | 8 bytes | 8 |

**Per riga**: ~118 bytes + 24 overhead = **142 bytes**

**Per utente (5 sostenitori)**: 142 × 5 = **710 bytes**

---

## 13. OVERHEAD INDICI E METADATI

PostgreSQL aggiunge:
- **24 bytes overhead** per ogni riga (già incluso nei calcoli)
- **Indici** su `utente_id`: ~50 bytes per riga correlata
- **Foreign key constraints**: ~20 bytes per relazione

**Stima overhead indici**: ~70 bytes × numero righe correlate

Per un utente con ~100 righe correlate: **~7 KB**

---

## 📊 RIEPILOGO TOTALE

| Categoria | Spazio |
|-----------|--------|
| **Tabella `users`** | 2.2 KB |
| **Tabelle voti** | 9.4 KB |
| **Opinioni proposte** | 5.0 KB |
| **Comunicazioni** | 7.5 KB |
| **Notifiche utente** | 30.9 KB |
| **Notifiche admin** | 5.25 KB |
| **Reazioni** | 3.1 KB |
| **Programmi** | 0.13 KB |
| **Richieste premium** | 0.06 KB |
| **Richieste grazia** | 0.004 KB |
| **Iniziative popolari** | 0.19 KB |
| **Referendum abrogativi** | 0.09 KB |
| **ICE** | 0.02 KB |
| **Sostenitori** | 0.71 KB |
| **Overhead indici** | 7.0 KB |

---

## 🎯 TOTALE FINALE PER UTENTE

### Scenario Base (Utente Normale)
**Totale**: **~72 KB** (0.072 MB)

### Scenario Utente Attivo (2x comunicazioni, 2x notifiche)
**Totale**: **~120 KB** (0.12 MB)

### Scenario Utente Molto Attivo (5x tutto)
**Totale**: **~300 KB** (0.3 MB)

### Scenario Utente Admin + Candidato
**Totale**: **~150 KB** (0.15 MB)

---

## 📈 PROIEZIONI PER SCALA

| Numero Utenti | Spazio Totale (Scenario Base) | Spazio Totale (Utente Attivo) |
|---------------|-------------------------------|-------------------------------|
| 1,000 | 72 MB | 120 MB |
| 10,000 | 720 MB | 1.2 GB |
| 100,000 | 7.2 GB | 12 GB |
| 1,000,000 | 72 GB | 120 GB |

---

## ⚠️ NOTE IMPORTANTI

1. **Questi calcoli sono stime conservative** basate su utilizzo tipico
2. **Lo spazio reale può variare** in base a:
   - Lunghezza effettiva dei testi (TEXT può essere molto grande)
   - Numero di FCM tokens (array può crescere)
   - Dimensione JSONB (avatar_config, social_links, etc.)
   - Numero di notifiche accumulate
   - Attività dell'utente

3. **PostgreSQL compressione**: 
   - TOAST (The Oversized-Attribute Storage Technique) comprime automaticamente campi TEXT > 2KB
   - JSONB è compresso internamente
   - Questo può ridurre lo spazio reale del 30-50%

4. **Indici aggiuntivi**:
   - Ogni indice occupa spazio aggiuntivo (~20-30% dei dati indicizzati)
   - Non incluso nei calcoli sopra

5. **Vacuum e ottimizzazioni**:
   - PostgreSQL può recuperare spazio con VACUUM
   - Dead tuples occupano spazio temporaneamente

---

## ✅ CONCLUSIONE

**Un singolo utente occupa approssimativamente:**
- **Minimo**: ~50 KB (utente base, poco attivo)
- **Medio**: ~72 KB (utente normale)
- **Massimo**: ~300 KB (utente molto attivo)

**Media realistica**: **~100 KB (0.1 MB) per utente**

Questo significa che:
- **10,000 utenti** = ~1 GB
- **100,000 utenti** = ~10 GB
- **1,000,000 utenti** = ~100 GB

