# 🚀 Migrazione Candidature ed Elezioni da Firestore a Neon

Questo documento spiega come migrare i dati di candidatura ed elezione dalla collezione "utenti" di Firestore alla tabella "users" di Neon.

## 📋 Prerequisiti

1. **File di configurazione Firestore**: Assicurati che `serviceAccountKey.json` sia presente nella root del progetto
2. **Variabile d'ambiente**: Imposta `DATABASE_URL` con la stringa di connessione di Neon
3. **Dipendenze**: Installa le dipendenze con `npm install`

## 🔍 Passo 1: Verifica Struttura Tabella

Prima di tutto, verifica la struttura attuale della tabella "users" in Neon:

```bash
npm run check-users-structure
```

Questo script ti mostrerà:
- Tutte le colonne esistenti nella tabella
- Quali colonne di candidatura ed elezione sono già presenti
- Quali colonne mancano
- Statistiche sui dati esistenti

## 🔧 Passo 2: Aggiungi Colonne Mancanti (se necessario)

Se mancano le colonne di candidatura ed elezione, aggiungile:

```bash
npm run add-candidature-columns
```

Questo script aggiungerà le seguenti colonne se non esistono:

### Colonne Candidatura:
- `candidato_attivo` (BOOLEAN)
- `status_candidatura` (VARCHAR(50))
- `grado_candidatura` (VARCHAR(50))
- `paese_candidatura` (VARCHAR(100))
- `regione_candidatura` (VARCHAR(100))
- `provincia_candidatura` (VARCHAR(100))
- `comune_candidatura` (VARCHAR(100))
- `data_candidatura` (DATE)
- `note_candidatura` (TEXT)

### Colonne Elezione:
- `grado_elezione` (VARCHAR(50))
- `paese_elezione` (VARCHAR(100))
- `regione_elezione` (VARCHAR(100))
- `provincia_elezione` (VARCHAR(100))
- `comune_elezione` (VARCHAR(100))

## 🚀 Passo 3: Migra i Dati

Ora migra i dati da Firestore a Neon:

```bash
npm run migrate-candidature
```

Questo script:
1. Recupera tutti gli utenti dalla collezione "utenti" di Firestore
2. Mappa gli utenti tramite email per trovare le corrispondenze in Neon
3. Aggiorna le colonne di candidatura ed elezione per ogni utente
4. Fornisce un report dettagliato dell'operazione

## 📊 Monitoraggio

Durante la migrazione, vedrai output come:

```
🚀 Iniziando migrazione candidature ed elezioni...
📥 Recuperando utenti da Firestore...
✅ Trovati 72 utenti in Firestore
📥 Recuperando utenti da Neon per il mapping...
✅ Trovati 72 utenti in Neon
📋 Mappa email creata per 72 utenti
🎯 Utenti con dati candidatura: 15
🗳️ Utenti con dati elezioni: 8
✅ Aggiornato utente: user@example.com (5 campi)
...
🎉 Migrazione completata!
📊 Riepilogo:
   ✅ Utenti aggiornati: 23
   ⚠️ Utenti saltati: 0
   ❌ Errori: 0
```

## 🔍 Verifica Finale

Dopo la migrazione, verifica nuovamente la struttura e i dati:

```bash
npm run check-users-structure
```

Dovresti vedere che le colonne ora contengono dati invece di essere vuote.

## ⚠️ Note Importanti

1. **Backup**: Assicurati di avere un backup della tabella "users" prima di eseguire la migrazione
2. **Email**: La migrazione si basa sull'email per mappare gli utenti tra Firestore e Neon
3. **Dati Null**: I campi vuoti in Firestore diventeranno NULL in Neon
4. **Timestamp**: Ogni aggiornamento aggiorna il campo `updated_at`

## 🐛 Risoluzione Problemi

### Errore "relation 'users' does not exist"
- Verifica che la tabella "users" esista in Neon
- Controlla la variabile `DATABASE_URL`

### Errore "serviceAccountKey.json not found"
- Assicurati che il file di configurazione Firestore sia presente
- Verifica i permessi del file

### Errore di connessione Firestore
- Verifica che `serviceAccountKey.json` contenga credenziali valide
- Controlla i permessi della collezione "utenti"

## 📞 Supporto

Se incontri problemi durante la migrazione, controlla:
1. I log della console per messaggi di errore dettagliati
2. La connessione al database Neon
3. I permessi di accesso a Firestore
4. La struttura della tabella "users" in Neon
