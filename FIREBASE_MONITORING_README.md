# Monitoraggio Consumi Firebase

Questo sistema permette di monitorare i consumi reali di Firebase (Firestore, Functions, Hosting, Storage) direttamente nell'app DEMOS.

## 🚀 Funzionalità Implementate

### 1. **Cloud Function per il Monitoraggio**
- **File**: `api/firebase-monitoring.js`
- **Funzione**: Interroga le API di Google Cloud Monitoring per recuperare dati reali
- **Servizi monitorati**:
  - **Firestore**: Letture, scritture, totale operazioni
  - **Cloud Functions**: Invocazioni, tempo di esecuzione, GB-seconds
  - **Hosting**: Richieste, bytes trasferiti, GB trasferiti
  - **Storage**: Numero oggetti, bytes utilizzati, GB utilizzati

### 2. **Integrazione nella Pagina "Analisi Consumi"**
- **File**: `client/src/pages/AnalisiConsumi.tsx`
- **Funzionalità**:
  - Visualizzazione dati in tempo reale
  - Aggiornamento manuale dei dati
  - Gestione errori e stati di caricamento
  - Tracciamento Analytics e Performance

## 📊 Dati Visualizzati

### Firestore
- **Letture**: Numero di operazioni di lettura
- **Scritture**: Numero di operazioni di scrittura
- **Totale**: Somma di letture e scritture

### Cloud Functions
- **Invocazioni**: Numero di volte che le funzioni sono state chiamate
- **Tempo esecuzione**: Tempo medio di esecuzione in millisecondi
- **GB-seconds**: Consumo di risorse calcolato

### Hosting
- **Richieste**: Numero di richieste HTTP
- **Bytes trasferiti**: Dimensione totale dei dati trasferiti
- **GB trasferiti**: Conversione in GB per facilità di lettura

### Storage
- **Oggetti**: Numero di file memorizzati
- **Bytes utilizzati**: Spazio occupato in bytes
- **GB utilizzati**: Conversione in GB per facilità di lettura

## 🔧 Configurazione

### 1. **Credenziali Firebase**
Il sistema usa il file `serviceAccountKey.json` esistente per l'autenticazione.

### 2. **Dipendenze Installate**
```bash
npm install googleapis
```

### 3. **Variabili d'Ambiente**
Assicurati che `FIREBASE_PROJECT_ID` sia impostato (default: 'demos-finale')

## 🎯 Utilizzo

### Accesso ai Dati
1. Vai alla pagina "Analisi Consumi" nell'app
2. I dati Firebase vengono caricati automaticamente
3. Usa il pulsante "Aggiorna Firebase" per aggiornare i dati

### Interpretazione dei Dati
- **Piano Spark (Gratuito)**:
  - Firestore: 50.000 letture/giorno, 20.000 scritture/giorno
  - Functions: 125.000 invocazioni/mese, 40.000 GB-seconds/mese
  - Hosting: 10 GB/mese
  - Storage: 5 GB/mese

### Monitoraggio dei Limiti
Il sistema ti aiuta a:
- Vedere se stai avvicinandoti ai limiti del piano gratuito
- Identificare quali servizi consumano di più
- Prevedere quando potresti dover passare a un piano a pagamento

## 🔍 Troubleshooting

### Errori Comuni

1. **"Errore nel recupero dati"**
   - Verifica che il service account abbia i permessi di lettura su Monitoring
   - Controlla che il project ID sia corretto

2. **Dati sempre a 0**
   - Potrebbe essere che non ci siano ancora dati di utilizzo
   - Verifica che i servizi Firebase siano effettivamente utilizzati

3. **Timeout delle richieste**
   - Le API di Google Cloud possono essere lente
   - Considera di implementare un sistema di cache

## 🚀 Prossimi Passi

### Miglioramenti Suggeriti

1. **Cache dei Dati**
   - Salvare i dati in Firestore per evitare chiamate ripetute
   - Aggiornare solo ogni ora/giorno

2. **Alert Automatici**
   - Notifiche quando si avvicina ai limiti
   - Email di avviso per superamento soglie

3. **Grafici Storici**
   - Visualizzare l'andamento nel tempo
   - Previsioni di consumo

4. **Integrazione con Vercel**
   - Aggiungere monitoraggio anche dei consumi Vercel
   - Dashboard unificata

## 📝 Note Tecniche

- I dati vengono recuperati per gli ultimi 30 giorni
- Le metriche sono aggregate per periodo
- Il sistema gestisce automaticamente gli errori di rete
- I dati vengono formattati per una facile lettura (es. separatori delle migliaia)

## 🔐 Sicurezza

- Le credenziali del service account sono già configurate
- L'endpoint è protetto e accessibile solo dall'app
- I dati non vengono esposti pubblicamente

---

**Autore**: Implementato per l'app DEMOS  
**Data**: Gennaio 2024  
**Versione**: 1.0 