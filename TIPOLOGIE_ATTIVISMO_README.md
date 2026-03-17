# 🌟 Sistema Tipologie di Attivismo

## 📋 Panoramica

Il sistema delle tipologie di attivismo permette agli utenti con ruolo "Attivista" di specificare le aree di interesse per il loro attivismo. Ogni attivista può selezionare fino a 5 tipologie diverse, ognuna rappresentata da un'emoji e un colore specifico.

## 🎯 Tipologie Disponibili

| Emoji | Nome | Tipo | Descrizione | Colore |
|-------|------|------|-------------|--------|
| 🌱 | Ambiente e Sostenibilità | `ambiente` | Protezione dell'ambiente, sostenibilità, cambiamenti climatici | Verde |
| 🤝 | Diritti Umani | `diritti_umani` | Tutela dei diritti fondamentali, uguaglianza, giustizia sociale | Blu |
| 📚 | Educazione | `educazione` | Accesso all'istruzione, formazione, cultura | Viola |
| 🏥 | Sanità | `sanita` | Accesso alle cure, salute pubblica, benessere | Rosso |
| 💼 | Lavoro e Economia | `lavoro` | Diritti dei lavoratori, economia sostenibile, occupazione | Arancione |
| 🎭 | Cultura e Arte | `cultura` | Promozione culturale, arte, patrimonio | Rosa |
| ⚽ | Sport | `sport` | Promozione sportiva, attività fisica, benessere | Verde smeraldo |
| ❤️ | Volontariato | `volontariato` | Aiuto sociale, solidarietà, supporto alla comunità | Arancione scuro |
| 🏛️ | Politica e Istituzioni | `politica` | Partecipazione democratica, trasparenza, riforme | Grigio |
| 💻 | Tecnologia e Innovazione | `tecnologia` | Innovazione digitale, accessibilità tecnologica | Indaco |
| 🐕 | Diritti degli Animali | `animali` | Protezione animale, benessere, diritti | Verde lime |
| ⚖️ | Giustizia | `giustizia` | Sistema giudiziario, legalità, diritti civili | Grigio scuro |

## 🗄️ Struttura Database

### Colonna `tipologie_attivismo`
- **Tipo**: `JSONB`
- **Default**: `'[]'::jsonb`
- **Indice**: GIN per performance ottimali

### Struttura JSON
```json
[
  {
    "tipo": "ambiente",
    "emoji": "🌱",
    "nome": "Ambiente e Sostenibilità",
    "descrizione": "Protezione dell'ambiente, sostenibilità, cambiamenti climatici",
    "colore": "#22c55e"
  }
]
```

## 🔌 API Endpoints

### 1. Lista Tipologie Disponibili
```
GET /api/attivismo-tipologie
```
Restituisce tutte le tipologie disponibili con emoji, nomi e descrizioni.

### 2. Aggiorna Tipologie Utente
```
PUT /api/attivismo-tipologie/:userId
```
Aggiorna le tipologie di attivismo per un utente specifico.

**Body:**
```json
{
  "tipologie": ["ambiente", "diritti_umani", "educazione"]
}
```

### 3. Lista Attivisti per Tipologia
```
GET /api/attivisti/tipologia/:tipo
```
Restituisce tutti gli attivisti che hanno una tipologia specifica.

### 4. Statistiche Tipologie
```
GET /api/attivisti/statistiche
```
Restituisce statistiche su quante persone hanno ogni tipologia.

## 🎨 Interfaccia Utente

### Pagina Attivisti
- **Colonna Emoji**: Mostra le emoji delle tipologie selezionate
- **Tooltip**: Al hover mostra i nomi completi delle tipologie
- **Filtri**: Possibilità di filtrare per tipologia (futuro)

### Modale Attivista
- **Sezione Tipologie**: Mostra le tipologie con emoji e nomi
- **Colori**: Ogni tipologia ha un colore di sfondo personalizzato

### Componente Selettore
- **ActivismTypeSelector**: Componente per selezionare le tipologie
- **Validazione**: Massimo 5 tipologie, minimo 1
- **Preview**: Anteprima delle selezioni con emoji

## 🔍 Query PostgreSQL

### Trova Attivisti per Tipologia
```sql
SELECT * FROM users 
WHERE ruolo = 'Attivista'
AND tipologie_attivismo @> '[{"tipo": "ambiente"}]';
```

### Conta Attivisti per Tipologia
```sql
SELECT 
  jsonb_array_elements(tipologie_attivismo)->>'tipo' as tipo,
  COUNT(*) as count
FROM users 
WHERE ruolo = 'Attivista'
GROUP BY tipo
ORDER BY count DESC;
```

### Attivisti con Multiple Tipologie
```sql
SELECT nome, cognome, tipologie_attivismo
FROM users 
WHERE ruolo = 'Attivista'
AND jsonb_array_length(tipologie_attivismo) > 1;
```

## 🚀 Implementazione

### 1. Database
- ✅ Colonna `tipologie_attivismo` aggiunta
- ✅ Indice GIN creato per performance
- ✅ Dati di esempio inseriti

### 2. Backend
- ✅ API endpoint per tipologie
- ✅ Validazione input
- ✅ Query PostgreSQL ottimizzate

### 3. Frontend
- ✅ Interfaccia aggiornata
- ✅ Componente selettore
- ✅ Modale con tipologie
- ✅ Costanti TypeScript

## 📊 Esempi di Utilizzo

### Aggiungere Tipologie a un Attivista
```javascript
const response = await fetch('/api/attivismo-tipologie/user123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    tipologie: ['ambiente', 'diritti_umani']
  })
});
```

### Filtrare Attivisti per Tipologia
```javascript
const response = await fetch('/api/attivisti/tipologia/ambiente');
const attivistiAmbiente = await response.json();
```

## 🔮 Funzionalità Future

1. **Filtri Avanzati**: Filtrare attivisti per multiple tipologie
2. **Statistiche Dashboard**: Grafici e analisi delle tipologie
3. **Raccomandazioni**: Suggerire attivisti simili
4. **Eventi per Tipologia**: Organizzare eventi per tipologie specifiche
5. **Notifiche**: Notificare attivisti di eventi nelle loro aree di interesse

## 🛠️ Manutenzione

### Aggiungere Nuova Tipologia
1. Aggiornare `TIPOLOGIE_ATTIVISMO` in `client/src/constants/attivismo-types.ts`
2. Aggiornare le funzioni helper in `api/routes/attivismo-tipologie.js`
3. Testare con dati di esempio

### Modificare Tipologia Esistente
1. Aggiornare la costante
2. Aggiornare le funzioni helper
3. Verificare che i dati esistenti siano compatibili

## 📝 Note Tecniche

- **Performance**: L'indice GIN permette query veloci su JSONB
- **Validazione**: Input validato sia lato client che server
- **Compatibilità**: Funziona con la struttura esistente del database
- **Scalabilità**: Facile aggiungere nuove tipologie senza modifiche al database
