# Guida Integrazione - Pagina Voti Parlamento

## ✅ Cosa è stato implementato

1. **Endpoint API**: `/api/voti-politici/ultime?limit=3` - Restituisce le ultime 3 votazioni
2. **Codice Frontend**: File Dart completo pronto all'uso
3. **Documentazione**: Guida completa per l'integrazione

## 📋 Passi per l'integrazione

### 1. Aggiungi il file Dart

Copia il file `voti-parlamento-page.dart` nella cartella del tuo progetto Flutter:
```
lib/pages/voti-parlamento-page.dart
```

### 2. Aggiungi il pulsante in `/gestisci`

Nella pagina di gestione, aggiungi questo pulsante:

```dart
ElevatedButton.icon(
  onPressed: () {
    Navigator.pushNamed(context, '/voti-parlamento');
  },
  icon: Icon(Icons.how_to_vote),
  label: Text('Voti Parlamento'),
  style: ElevatedButton.styleFrom(
    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
  ),
),
```

### 3. Aggiungi la route

Nel file delle route (es. `lib/routes.dart` o `main.dart`):

```dart
import 'pages/voti-parlamento-page.dart';

// Nelle routes:
routes: {
  '/voti-parlamento': (context) => VotiParlamentoPage(),
  // ... altre route
},
```

### 4. Configura l'autenticazione

Nel file `voti-parlamento-page.dart`, sostituisci:

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
Uri.parse('https://api.demos.community/api/voti-politici/ultime?limit=3')
```

Se usi un URL diverso, aggiornalo nel file.

## 🎨 Caratteristiche della pagina

- ✅ Mostra le **ultime 3 votazioni** in ordine cronologico
- ✅ La prima votazione è evidenziata con badge "PIÙ RECENTE"
- ✅ Mostra Camera/Senato, data, esito, descrizione
- ✅ Spiegazione AI (se disponibile)
- ✅ Pulsante refresh per ricaricare
- ✅ Gestione errori e stati di caricamento
- ✅ Design moderno e responsive

## 🔄 Test

1. Avvia l'app
2. Vai alla pagina `/gestisci`
3. Clicca su "Voti Parlamento"
4. Verifica che le 3 votazioni vengano caricate correttamente

## 📝 Note

- L'endpoint restituisce le votazioni ordinate per data (più recente prima)
- Se ci sono meno di 3 votazioni, mostra quelle disponibili
- La prima votazione ha elevazione maggiore per evidenziarla
- Le spiegazioni AI sono mostrate in modo compatto (max 3 righe)

## 🚀 Prossimi miglioramenti

- Espandere le spiegazioni AI al tap
- Aggiungere pagina dettaglio per ogni votazione
- Filtri per Camera/Senato
- Timeline cronologica completa
