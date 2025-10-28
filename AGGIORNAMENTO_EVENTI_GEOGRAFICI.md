# 🗺️ Aggiornamento Dati Geografici Tabella Eventi

## 📋 Panoramica
Questo script aggiorna i dati geografici nella tabella "eventi" per standardizzare i valori secondo le convenzioni utilizzate nel resto dell'applicazione.

## 🔄 Modifiche Applicate

### 1. Paese Evento
- **Prima**: "Italia" 
- **Dopo**: "it"

### 2. Regione Evento  
- **Prima**: Nomi completi ("Lombardia", "Toscana", "Sicilia")
- **Dopo**: Sigle ISTAT ("LO", "TO", "SI")

### 3. Provincia Evento
- **Prima**: Nomi completi ("Milano", "Roma", "Napoli") 
- **Dopo**: Targhe automobilistiche ("MI", "RM", "NA")

## 🚀 Come Eseguire lo Script

### Prerequisiti
1. Assicurati che il file `.env` contenga la stringa di connessione corretta a Neon:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

### Esecuzione
```bash
node update-eventi-geographic-data.cjs
```

### Output Atteso
```
🗺️ Aggiornamento dati geografici tabella eventi...
✅ Connesso al database Neon
📋 Tabella eventi trovata, procedo con l'aggiornamento...
📊 Trovati X eventi da aggiornare
🔄 Evento 123: paese_evento "Italia" -> "it"
🔄 Evento 123: regione_evento "Lombardia" -> "LO"
🔄 Evento 123: provincia_evento "Milano" -> "MI"
✅ Evento 123 aggiornato
🎉 Aggiornamento completato! X eventi modificati su Y totali
📊 Statistiche finali:
   - Totale eventi: X
   - Paese "it": Y
   - Regioni con sigle (2 lettere): Z
   - Province con targhe (2 lettere): W
🔌 Connessione database chiusa
```

## 🔧 Modifiche Frontend

### File Modificati
1. **`client/src/utils/eventiGeographicUtils.ts`** - Nuovo file con utilità per conversione dati geografici
2. **`client/src/pages/Eventi.tsx`** - Aggiornato per visualizzare dati decompressi e comprimere in invio
3. **`client/src/pages/Evento.tsx`** - Aggiornato per comprimere dati geografici prima dell'invio

### Funzionalità Aggiunte
- **Decompressione automatica**: I dati compressi dal database vengono automaticamente convertiti in formato leggibile per l'utente
- **Compressione automatica**: I dati inseriti dall'utente vengono automaticamente compressi prima dell'invio al database
- **Visualizzazione migliorata**: Le localizzazioni vengono mostrate in formato completo e leggibile

## ⚠️ Note Importanti

1. **Backup**: Prima di eseguire lo script, assicurati di avere un backup del database
2. **Test**: Testa lo script su un ambiente di sviluppo prima di eseguirlo in produzione
3. **Rollback**: Se necessario, è possibile ripristinare i dati originali usando i valori decompressi

## 🔍 Verifica Post-Esecuzione

Dopo l'esecuzione dello script, verifica che:
- [ ] I dati geografici siano stati convertiti correttamente
- [ ] Le pagine `/eventi` e `/evento` funzionino correttamente
- [ ] I nuovi eventi vengano salvati con i valori compressi
- [ ] Gli eventi esistenti vengano visualizzati correttamente

## 📞 Supporto

Se riscontri problemi durante l'esecuzione, controlla:
1. La configurazione della DATABASE_URL
2. I permessi di accesso al database
3. La presenza della tabella "eventi"
4. I log di errore per dettagli specifici
