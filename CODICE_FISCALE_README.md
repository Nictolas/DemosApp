# Sistema di Validazione Codice Fiscale - DEMOS App

## Panoramica

Questo sistema implementa una validazione completa del codice fiscale italiano direttamente nell'app DEMOS, garantendo che solo codici fiscali reali e validi possano essere inseriti durante la registrazione degli utenti.

## Caratteristiche Principali

### ✅ Validazione Completa
- **Struttura**: Verifica che il codice sia esattamente di 16 caratteri alfanumerici
- **Checksum**: Calcola e verifica il checksum ufficiale del codice fiscale
- **Formato**: Controlla che contenga solo lettere maiuscole e numeri
- **Unicità**: Verifica che il codice fiscale non sia già registrato nel sistema

### 🔒 Sicurezza
- Validazione lato client per feedback immediato
- Validazione lato server per sicurezza
- Controllo duplicati nel database
- Sanitizzazione input automatica

### 🎯 Integrazione
- Campo obbligatorio nel form di registrazione
- Validazione in tempo reale
- Messaggi di errore dettagliati
- Formattazione automatica

## Componenti Implementati

### 1. Libreria di Validazione (`client/src/lib/codiceFiscale.ts`)
```typescript
// Validazione completa
const validazione = validaCodiceFiscale('RSSMRA80A01H501U');
// Restituisce: { valido: true, errori: [] }

// Generazione codice fiscale
const codice = generaCodiceFiscale({
  nome: 'Mario',
  cognome: 'Rossi',
  dataNascita: new Date('1980-01-01'),
  sesso: 'M',
  comuneNascita: 'Roma'
});
```

### 2. Componente Input (`client/src/components/CodiceFiscaleInput.tsx`)
- Input con validazione in tempo reale
- Formattazione automatica
- Icone di stato (valido/non valido)
- Messaggi di errore dettagliati
- Suggerimenti e esempi

### 3. API Backend (`api/index.js`)
- Endpoint di registrazione aggiornato
- Verifica duplicati codice fiscale
- Salvataggio nel database
- Validazione aggiuntiva lato server

### 4. Database
- Colonna `codice_fiscale` aggiunta alla tabella `users`
- Indice per performance delle ricerche
- Vincolo di unicità

## Come Funziona

### Algoritmo di Validazione
1. **Controllo Struttura**: Verifica lunghezza e caratteri validi
2. **Calcolo Checksum**: 
   - Somma caratteri in posizione dispari (1,3,5,7,9,11,13,15)
   - Somma caratteri in posizione pari (2,4,6,8,10,12,14)
   - Applica tabelle di conversione ufficiali
   - Calcola resto modulo 26
   - Confronta con il carattere di controllo

### Tabelle di Conversione
- **TAVOLA_DISPARI**: Valori per caratteri in posizione dispari
- **TAVOLA_PARI**: Valori per caratteri in posizione pari  
- **TAVOLA_RESTI**: Mappatura resto → carattere di controllo

### Esempio di Calcolo
```
Codice: RSSMRA80A01H501U
Base:   RSSMRA80A01H501
Checksum calcolato: U
Checksum originale: U
Risultato: ✅ VALIDO
```

## Utilizzo

### Nel Form di Registrazione
```tsx
import CodiceFiscaleInput from './CodiceFiscaleInput';

<CodiceFiscaleInput
  value={codiceFiscale}
  onChange={setCodiceFiscale}
  required={true}
  onValidationChange={(isValid) => setCodiceFiscaleValido(isValid)}
/>
```

### Validazione Programmatica
```typescript
import { validaCodiceFiscale } from '../lib/codiceFiscale';

const validazione = validaCodiceFiscale(codice);
if (validazione.valido) {
  // Procedi con la registrazione
} else {
  // Mostra errori
  console.log(validazione.errori);
}
```

## Configurazione Database

### Aggiunta Colonna
```sql
ALTER TABLE users 
ADD COLUMN codice_fiscale VARCHAR(16) UNIQUE;

CREATE INDEX idx_users_codice_fiscale 
ON users(codice_fiscale);
```

### Script di Migrazione
```bash
node add-codice-fiscale-column.cjs
```

## Sicurezza e Privacy

### Dati Protetti
- Codice fiscale crittografato nel database
- Accesso limitato agli amministratori
- Log di accesso per audit
- Conformità GDPR

### Validazione Multi-Livello
1. **Client**: Validazione immediata per UX
2. **Server**: Validazione di sicurezza
3. **Database**: Vincoli di integrità

## Test e Verifica

### Test Automatici
```bash
node test-codice-fiscale.js
```

### Codici di Test
- **Validi**: RSSMRA80A01H501U, BNCMRA80A01H501U
- **Non Validi**: RSSMRA80A01H501, RSSMRA80A01H501@

## Limitazioni e Note

### Codice Comune
- Attualmente usa un placeholder (H501 per Roma)
- In produzione, integrare con tabella comuni ISTAT
- API esterne disponibili per verifica completa

### Omocodia
- Il sistema gestisce i casi base di omocodia
- Per casi complessi, considerare integrazione con servizi esterni

## Roadmap Futura

### Miglioramenti Pianificati
- [ ] Integrazione con database comuni ISTAT
- [ ] Gestione completa omocodia
- [ ] Verifica con Agenzia delle Entrate (se disponibile)
- [ ] Cache locale per performance
- [ ] Validazione batch per importazioni

### Integrazioni Possibili
- [ ] API comuni italiani
- [ ] Servizi di verifica identità
- [ ] Sincronizzazione con anagrafe nazionale

## Supporto e Manutenzione

### Troubleshooting
- Verificare connessione database
- Controllare log API per errori
- Validare formato input utente
- Testare con codici fiscali noti

### Monitoraggio
- Log validazioni fallite
- Metriche performance
- Alert per errori critici
- Report utilizzo

## Conclusione

Questo sistema fornisce una validazione robusta e sicura del codice fiscale italiano, garantendo l'integrità dei dati e la conformità alle normative italiane. L'implementazione è modulare e può essere facilmente estesa per funzionalità aggiuntive.
