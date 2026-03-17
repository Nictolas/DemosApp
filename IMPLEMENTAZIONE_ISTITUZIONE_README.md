# Implementazione Tipologia Utente "Istituzione" e Sezione "Comunica Voti"

## Modifiche Implementate

### 1. Aggiunta Tipologia Utente "Istituzione"

#### File Modificati:
- `client/src/types/user.ts` - Aggiunto tipo `UserRole` con "Istituzione"
- `client/src/components/gestisci-utenti/types.ts` - Aggiornato tipo `User`
- `client/src/pages/Menu/types/index.ts` - Aggiornato interfaccia `User`

#### Caratteristiche:
- Nuovo ruolo "Istituzione" disponibile nel sistema
- Compatibile con la struttura esistente del database
- Tipizzazione TypeScript completa

### 2. Sezione "Comunica Voti" nella Pagina Votazione

#### File Modificato:
- `client/src/pages/Votazione.tsx`

#### Funzionalità Implementate:

##### Controllo Permessi:
- La sezione è visibile solo agli utenti con ruolo "Admin" o "Istituzione"
- Controllo implementato tramite variabile `canComunicaVoti`

##### Form Dinamico:
- **Titolo della votazione**: Campo obbligatorio per identificare la votazione
- **Gestione voti dinamica**: 
  - Aggiunta/rimozione voti tramite pulsanti
  - Ogni voto ha nome e tipo (Favorevole/Contrario/Astenuto)
  - Validazione per evitare rimozione dell'ultimo voto

##### Calcolo Automatico:
- **Conteggio automatico**: Favorevoli, Contrari, Astenuti, Totale
- **Risultato automatico**: 
  - "Approvata" se Favorevoli > Contrari
  - "Respinta" se Contrari > Favorevoli  
  - "Pareggio" se Favorevoli = Contrari
- **Visualizzazione real-time**: I risultati si aggiornano automaticamente

##### Interfaccia Utente:
- Design responsive con griglia adattiva
- Icone intuitive (Calculator, Plus, Trash2)
- Colori semantici per i risultati (verde/rosso/grigio)
- Pulsante salva disabilitato se mancano dati obbligatori

### 3. Struttura Dati

#### Interfacce TypeScript:
```typescript
interface VotoEntry {
  id: string;
  nome: string;
  voto: "Favorevole" | "Contrario" | "Astenuto";
}

type ComunicaVotiFormData = {
  titolo: string;
  voti: Array<{
    nome: string;
    voto: "Favorevole" | "Contrario" | "Astenuto";
  }>;
}
```

#### Schema Validazione:
- Validazione con Zod per i dati del form
- Controllo obbligatorietà titolo e almeno un voto
- Validazione nomi non vuoti per il calcolo

### 4. Funzionalità di Calcolo

#### Logica di Calcolo:
```typescript
const calculateResult = () => {
  const favorevoli = votiEntries.filter(entry => 
    entry.voto === "Favorevole" && entry.nome.trim()
  ).length;
  const contrari = votiEntries.filter(entry => 
    entry.voto === "Contrario" && entry.nome.trim()
  ).length;
  const astenuti = votiEntries.filter(entry => 
    entry.voto === "Astenuto" && entry.nome.trim()
  ).length;
  
  return {
    favorevoli,
    contrari,
    astenuti,
    totale: favorevoli + contrari + astenuti,
    risultato: favorevoli > contrari ? "Approvata" : 
               contrari > favorevoli ? "Respinta" : "Pareggio"
  };
};
```

### 5. Integrazione con Sistema Esistente

#### Compatibilità:
- Mantiene la funzionalità esistente della pagina votazione
- Non interferisce con i controlli di accesso esistenti
- Utilizza gli stessi componenti UI del design system

#### Permessi:
- **Sezione originale**: Accessibile a Politico, Candidato Politico, Admin
- **Nuova sezione**: Accessibile solo ad Admin e Istituzione
- **Controllo granulare**: Ogni sezione ha i propri controlli di accesso

### 6. Prossimi Passi Suggeriti

#### Database:
1. Eseguire lo script `add-istituzione-user-type.cjs` per aggiungere utenti di test
2. Creare endpoint API per salvare i voti delle istituzioni
3. Aggiungere tabella per memorizzare le votazioni istituzionali

#### Funzionalità:
1. Implementare salvataggio persistente dei voti
2. Aggiungere storico delle votazioni
3. Implementare esportazione risultati in PDF/Excel
4. Aggiungere notifiche per nuove votazioni

#### UI/UX:
1. Aggiungere conferma prima di salvare
2. Implementare modifica voti esistenti
3. Aggiungere filtri e ricerca nelle votazioni
4. Implementare visualizzazione grafica dei risultati

## Note Tecniche

- **Framework**: React + TypeScript
- **Validazione**: Zod
- **UI**: shadcn/ui components
- **State Management**: React hooks (useState)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Test

Per testare la funzionalità:
1. Accedere con un utente Admin o Istituzione
2. Navigare alla pagina `/votazione`
3. Verificare la presenza della sezione "Comunica Voti"
4. Testare l'aggiunta/rimozione di voti
5. Verificare il calcolo automatico dei risultati
