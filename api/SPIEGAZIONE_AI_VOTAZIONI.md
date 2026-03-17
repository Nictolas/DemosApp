# Spiegazione AI delle Votazioni

## Descrizione

È stata aggiunta una nuova colonna "Spiegazione" alla tabella `voti_camera` che contiene spiegazioni AI generate automaticamente per ogni votazione. Le spiegazioni sono generate usando Groq API (gratuito) o OpenAI API (a pagamento) e forniscono una spiegazione chiara e accessibile della votazione per cittadini non esperti.

## Configurazione

### Opzione 1: Groq API (GRATUITO - CONSIGLIATO) ⭐

Aggiungi al file `.env`:

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-70b-versatile  # Opzionale
```

Vedi `CONFIGURAZIONE_GROQ.md` per istruzioni dettagliate.

### Opzione 2: OpenAI API (A PAGAMENTO)

Aggiungi al file `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Opzionale, default: gpt-4o-mini
OPENAI_DAILY_LIMIT=50  # Limite giornaliero
```

### Database

Esegui lo script SQL per aggiungere la colonna:

```bash
psql $DATABASE_URL -f add-spiegazione-column-voti-camera.sql
```

Oppure esegui direttamente:

```sql
ALTER TABLE voti_camera ADD COLUMN IF NOT EXISTS spiegazione TEXT;
CREATE INDEX IF NOT EXISTS idx_voti_camera_spiegazione ON voti_camera(spiegazione) WHERE spiegazione IS NOT NULL;
```

## Funzionalità

### Generazione automatica

Le spiegazioni vengono generate automaticamente durante la sincronizzazione dei voti (`sync-voti-openpolis.js`). Quando viene salvata una nuova votazione, viene generata anche la spiegazione in background.

### Generazione manuale

#### Per un singolo politico (Admin)

```bash
POST /api/voti-camera/:politico/spiegazione
Authorization: Bearer <token>
```

Esempio:
```bash
curl -X POST https://www.demos.community/api/voti-camera/Giorgia%20Meloni/spiegazione \
  -H "Authorization: Bearer <token>"
```

#### Per tutte le votazioni senza spiegazione (Admin)

```bash
POST /api/voti-camera/genera-spiegazioni
Authorization: Bearer <token>
Content-Type: application/json

{
  "limit": 10  # Opzionale, default: 10
}
```

## Aggiornamento Frontend

### 1. Aggiorna il componente VotiPolitici.tsx

Aggiungi la colonna "Spiegazione" alla tabella:

```typescript
// Nella definizione delle colonne
{
  header: 'Spiegazione',
  accessorKey: 'spiegazione',
  cell: ({ row }) => {
    const spiegazione = row.original.spiegazione;
    if (!spiegazione) {
      return (
        <span className="text-gray-400 italic">Non disponibile</span>
      );
    }
    return (
      <div className="max-w-md">
        <p className="text-sm text-gray-700">{spiegazione}</p>
      </div>
    );
  }
}
```

### 2. Aggiungi pulsante per generare spiegazione (Admin)

Per ogni riga della tabella, se l'utente è admin e non c'è spiegazione:

```typescript
{isAdmin && !row.original.spiegazione && (
  <Button
    onClick={() => generaSpiegazione(row.original.politico_nome)}
    size="sm"
    variant="outline"
  >
    Genera Spiegazione
  </Button>
)}
```

### 3. Funzione per generare spiegazione

```typescript
const generaSpiegazione = async (politicoNome: string) => {
  try {
    const response = await fetch(
      `/api/voti-camera/${encodeURIComponent(politicoNome)}/spiegazione`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      // Ricarica i dati
      refetch();
      toast.success('Spiegazione generata con successo');
    } else {
      toast.error('Errore nella generazione della spiegazione');
    }
  } catch (error) {
    console.error('Errore:', error);
    toast.error('Errore nella generazione della spiegazione');
  }
};
```

### 4. Aggiorna il tipo/interfaccia TypeScript

Se usi TypeScript, aggiorna l'interfaccia:

```typescript
interface VotazionePolitico {
  politico_nome: string;
  camera: string;
  url_openpolis: string;
  votazione: string | null;
  voto: string | null;
  data_votazione: string | null;
  ultimo_aggiornamento: string | null;
  spiegazione?: string | null;  // Nuovo campo
}
```

## Note

- Le spiegazioni vengono generate solo se `OPENAI_API_KEY` è configurato
- Se la generazione fallisce, il processo continua senza bloccare la sincronizzazione
- Le spiegazioni esistenti non vengono rigenerate automaticamente
- La generazione avviene in background per non bloccare l'API
- Le spiegazioni hanno un limite di ~150 parole per essere concise e comprensibili

## Costi

La generazione delle spiegazioni utilizza l'API di OpenAI. Con `gpt-4o-mini`:
- Costo per spiegazione: ~$0.0001-0.0002
- Per 100 votazioni: ~$0.01-0.02

## Troubleshooting

### Le spiegazioni non vengono generate

1. Verifica che `OPENAI_API_KEY` sia configurato nel `.env`
2. Controlla i log del server per errori
3. Verifica che il modello OpenAI sia disponibile

### Errore 403 quando si genera spiegazione

- Verifica che l'utente sia admin (`ruolo = 'admin'` o `'AD'`)
- Verifica che il token JWT sia valido

### Le spiegazioni sono vuote o incomplete

- Controlla che la votazione non sia vuota
- Verifica i log per errori nella generazione
- Potrebbe essere un problema di rate limiting di OpenAI
