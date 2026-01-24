# Guida Integrazione - Pagina Bacheca

## ✅ Cosa è stato implementato

1. **Endpoint API**: `/api/bacheca` - Restituisce i dati per la bacheca dell'utente
2. **Codice Frontend**: File Dart completo pronto all'uso (`bacheca-page.dart`)
3. **Documentazione**: Guida completa per l'integrazione

## 📋 Passi per l'integrazione

### 1. Aggiungi il file Dart

Copia il file `bacheca-page.dart` nella cartella del tuo progetto Flutter:
```
lib/pages/bacheca-page.dart
```

### 2. Aggiungi il pulsante nella navbar

Nella tua navbar o menu principale, aggiungi questo pulsante. Esempio con `BottomNavigationBar`:

```dart
BottomNavigationBar(
  items: [
    // ... altri items esistenti
    BottomNavigationBarItem(
      icon: Icon(Icons.dashboard),
      label: 'Bacheca',
    ),
    // ... altri items
  ],
  onTap: (index) {
    if (index == /* indice del pulsante Bacheca */) {
      Navigator.pushNamed(context, '/bacheca');
    }
  },
)
```

Oppure se usi un `Drawer`:

```dart
Drawer(
  child: ListView(
    children: [
      // ... altri items esistenti
      ListTile(
        leading: Icon(Icons.dashboard),
        title: Text('Bacheca'),
        onTap: () {
          Navigator.pop(context); // Chiudi il drawer
          Navigator.pushNamed(context, '/bacheca');
        },
      ),
      // ... altri items
    ],
  ),
)
```

Oppure se usi un `AppBar` con azioni:

```dart
AppBar(
  title: Text('Titolo'),
  actions: [
    // ... altre azioni esistenti
    IconButton(
      icon: Icon(Icons.dashboard),
      onPressed: () {
        Navigator.pushNamed(context, '/bacheca');
      },
      tooltip: 'Bacheca',
    ),
    // ... altre azioni
  ],
)
```

### 3. Aggiungi la route

Nel file delle route (es. `lib/routes.dart` o `main.dart`):

```dart
import 'pages/bacheca-page.dart';

// Nelle routes:
routes: {
  '/bacheca': (context) => BachecaPage(),
  // ... altre route
},
```

### 4. Configura l'autenticazione

Nel file `bacheca-page.dart`, sostituisci:

```dart
// Sostituisci questa riga:
final token = 'YOUR_TOKEN_HERE';

// Con il tuo servizio di autenticazione:
final token = await AuthService.getToken();
```

E aggiungi l'import:
```dart
import '../services/auth_service.dart'; // O il percorso corretto
```

### 5. Verifica l'URL dell'API

Assicurati che l'URL dell'API sia corretto:
```dart
Uri.parse('https://api.demos.community/api/bacheca')
```

Se usi un URL diverso, aggiornalo nel file.

## 🎨 Caratteristiche della pagina

- ✅ Mostra **notifiche recenti** (ultime 5)
- ✅ Mostra **votazioni recenti** (ultime 3)
- ✅ Mostra **eventi** (ultimi 5)
- ✅ Mostra **attività recenti** dell'utente (ultime 5)
- ✅ Pulsante refresh per ricaricare i dati
- ✅ Gestione errori e stati di caricamento
- ✅ Design responsive e moderno

## 📱 Struttura dei dati

L'endpoint `/api/bacheca` restituisce:

```json
{
  "success": true,
  "data": {
    "notifiche_recenti": [
      {
        "id": 1,
        "titolo": "Titolo notifica",
        "messaggio": "Messaggio notifica",
        "tipo": "tipo_notifica",
        "data": "2026-01-24T10:00:00.000Z"
      }
    ],
    "votazioni_recenti": [
      {
        "id": 1,
        "descrizione": "Descrizione votazione",
        "camera": "Camera",
        "data_votazione": "2026-01-24T10:00:00.000Z",
        "esito": "Approvato"
      }
    ],
    "eventi": [
      {
        "id": 1,
        "titolo": "Titolo evento",
        "descrizione": "Descrizione evento",
        "data": "2026-01-24T10:00:00.000Z"
      }
    ],
    "attivita": [
      {
        "tipo": "opinione",
        "descrizione": "Descrizione attività",
        "data": "2026-01-24T10:00:00.000Z"
      }
    ]
  }
}
```

## 🔧 Personalizzazione

Puoi personalizzare la pagina modificando:

1. **Numero di elementi mostrati**: Modifica i `LIMIT` nelle query SQL in `routes/bacheca.js`
2. **Tipi di contenuto**: Aggiungi nuove sezioni modificando sia il backend che il frontend
3. **Stile**: Modifica i colori, icone e layout nel file `bacheca-page.dart`

## 📝 Note

- La pagina richiede autenticazione (token JWT)
- I dati vengono caricati automaticamente all'apertura della pagina
- Il pulsante refresh permette di ricaricare i dati manualmente
- La pagina gestisce correttamente gli stati di caricamento e gli errori
