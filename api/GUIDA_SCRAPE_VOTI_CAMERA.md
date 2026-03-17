# 📋 Guida per Popolare la Tabella voti_camera

Questa guida spiega come eseguire lo script Python per popolare la tabella `voti_camera` con i dati delle votazioni dei deputati.

## 🔧 Prerequisiti

1. **Python 3.8+** installato
2. **Playwright** installato
3. **Dipendenze Python** installate
4. **File .env** configurato con le credenziali del database

## 📦 Installazione Dipendenze

```bash
# Installa le dipendenze Python
pip install -r requirements.txt

# Installa i browser per Playwright
playwright install chromium
```

## ⚙️ Configurazione

Aggiungi al file `.env` nella cartella `api/` una delle seguenti opzioni:

### Opzione 3: Legislatura (Opzionale)
Per cambiare la legislatura (default: 19 per XIX legislatura):
```env
LEGISLATURA=19
```
Per la XVIII legislatura usa `LEGISLATURA=18`.

### Opzione 1: DATABASE_URL (Consigliata)
```env
DATABASE_URL=postgresql://username:password@host.db.neon.tech/neondb?sslmode=require
```

### Opzione 2: Variabili Separate
```env
DB_HOST=ep-xxxxx-xxxxx-pooler.eu-central-1.aws.neon.tech
DB_USER=neondb_owner
DB_PASSWORD=la_tua_password
DB_NAME=neondb
```

## 🧪 Test Connessione

Prima di eseguire lo script principale, testa la connessione:

```bash
cd api
python test-voti-camera-connection.py
```

Questo script verificherà:
- ✅ Connessione al database
- ✅ Esistenza della tabella `voti_camera`
- ✅ Struttura della tabella
- ✅ Capacità di inserire/aggiornare record

## 🚀 Esecuzione Script

```bash
cd api
python scrape_voti_camera.py
```

Lo script:
1. Si connette al database Neon
2. Apre il browser (headless)
3. Naviga sul sito della Camera dei Deputati (URL con parametro Legislatura)
4. Seleziona il tipo votazione "FINALE" (filtra solo le votazioni finali)
5. Per ogni deputato nel menu "Nominativo partecipante alla votazione":
   - Seleziona il deputato
   - Clicca su "Avvia la ricerca"
   - Estrae la votazione più recente (prima riga dei risultati)
   - Salva i dati nella tabella `voti_camera`
6. Mostra un riepilogo finale

## ⏱️ Tempi di Esecuzione

- **Tempo stimato**: 10-15 minuti per ~400 deputati
- Ogni deputato richiede ~3-5 secondi (selezione tipo + selezione deputato + ricerca + estrazione + salvataggio)
- Lo script filtra solo le votazioni di tipo "FINALE" per ogni deputato

## 🔍 Risoluzione Problemi

### Errore: "Tabella voti_camera non trovata"
Assicurati che la tabella esista nel database. Verifica con:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'voti_camera';
```

### Errore: "Menu a tendina dei deputati non trovato"
Il sito potrebbe aver cambiato struttura. Controlla manualmente:
https://documenti.camera.it/apps/votazioni/votazionitutte/FormVotazioni.Asp

### Errore: "Nessun risultato trovato"
Alcuni deputati potrebbero non avere votazioni recenti. Questo è normale.

### Errore: "Timeout"
Aumenta i timeout nello script o verifica la connessione internet.

## 📊 Verifica Risultati

Dopo l'esecuzione, verifica i dati:

```sql
-- Conta i record
SELECT COUNT(*) FROM voti_camera;

-- Vedi alcuni esempi
SELECT * FROM voti_camera LIMIT 10;

-- Politici con votazioni più recenti
SELECT politico_nome, data_votazione, oggetto_voto, esito_voto 
FROM voti_camera 
ORDER BY data_votazione DESC 
LIMIT 20;
```

## 🔄 Aggiornamento Dati

Per aggiornare i dati, esegui semplicemente lo script di nuovo. I record esistenti verranno aggiornati grazie al `ON CONFLICT` o al controllo manuale.

## 📝 Note

- Lo script estrae solo la **prima votazione** (più recente) per ogni deputato
- I dati vengono salvati immediatamente dopo l'estrazione
- In caso di errore per un deputato, lo script continua con gli altri
- Il browser viene eseguito in modalità headless (senza interfaccia grafica)

