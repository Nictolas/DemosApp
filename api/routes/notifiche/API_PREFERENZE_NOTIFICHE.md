# API Preferenze Notifiche - Documentazione

## Endpoint Disponibili

### GET /api/notifiche/preferenze
Recupera tutte le preferenze notifiche dell'utente autenticato.

**Autenticazione**: Richiesta (Bearer Token)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "preferenze": {
      "eurodeputato": false,
      "senatore": false,
      "deputato": false,
      "consigliere_regionale": false,
      "consigliere_comunale": false,
      "attivisti": false,
      "demos": false,
      "scuola": false,
      "animali": true,
      "organizzazioni": false
    },
    "updated_at": "2025-01-01T12:00:00Z"
  }
}
```

**Note**: Se l'utente non ha preferenze, viene creato un record con valori di default.

---

### POST /api/notifiche/preferenze
Salva o aggiorna le preferenze notifiche dell'utente.

**Autenticazione**: Richiesta (Bearer Token)

**Body**:
```json
{
  "preferenze": {
    "eurodeputato": true,
    "senatore": false,
    "deputato": true,
    "consigliere_regionale": false,
    "consigliere_comunale": true,
    "attivisti": false,
    "demos": true,
    "scuola": false,
    "animali": true,
    "organizzazioni": false
  }
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Preferenze salvate con successo",
  "data": {
    "user_id": "uuid",
    "preferenze": {
      "eurodeputato": true,
      "senatore": false,
      "deputato": true,
      "consigliere_regionale": false,
      "consigliere_comunale": true,
      "attivisti": false,
      "demos": true,
      "scuola": false,
      "animali": true,
      "organizzazioni": false
    },
    "updated_at": "2025-01-01T12:00:00Z"
  }
}
```

**Error 400**: Preferenze non valide
```json
{
  "success": false,
  "error": "Preferenze devono essere un oggetto"
}
```

---

## Struttura Preferenze

### Categorie

#### 1. Rappresentanti Istituzionali
- `eurodeputato` - Notifiche dal tuo eurodeputato
- `senatore` - Notifiche dal tuo senatore
- `deputato` - Notifiche dal tuo deputato
- `consigliere_regionale` - Notifiche dal tuo consigliere regionale
- `consigliere_comunale` - Notifiche dal tuo consigliere comunale

#### 2. Piattaforma
- `demos` - Notifiche generali della piattaforma
- `attivisti` - Notifiche da attivisti che segui
- `organizzazioni` - Notifiche da organizzazioni che segui

#### 3. Altro
- `scuola` - Notifiche per questioni scolastiche
- `animali` - Notifiche per avvistamenti di animali (default: `true`)

---

## Valori di Default

- `animali`: `true` (attivo di default)
- Tutte le altre: `false` (disattivate di default)

---

## Esempio Frontend (Flutter/Dart)

```dart
// Recupera preferenze
Future<Map<String, bool>> getNotificationPreferences() async {
  final response = await http.get(
    Uri.parse('$apiUrl/notifiche/preferenze'),
    headers: {'Authorization': 'Bearer $token'},
  );
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return Map<String, bool>.from(data['data']['preferenze']);
  }
  throw Exception('Errore nel recupero preferenze');
}

// Salva preferenze
Future<void> saveNotificationPreferences(Map<String, bool> preferences) async {
  final response = await http.post(
    Uri.parse('$apiUrl/notifiche/preferenze'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({'preferenze': preferences}),
  );
  
  if (response.statusCode != 200) {
    throw Exception('Errore nel salvataggio preferenze');
  }
}
```

---

## Suggerimenti per la Pagina Frontend

### Organizzazione Consigliata

1. **Sezione Rappresentanti**
   - Eurodeputato
   - Senatore
   - Deputato
   - Consigliere Regionale
   - Consigliere Comunale

2. **Sezione Piattaforma**
   - Demos
   - Attivisti
   - Organizzazioni

3. **Sezione Altro**
   - Scuola
   - Animali

### UI/UX Consigliata

- Usa switch/toggle per ogni preferenza
- Raggruppa per categorie con titoli chiari
- Mostra descrizioni brevi per ogni tipo
- Salvataggio automatico o pulsante "Salva" ben visibile
- Feedback visivo dopo il salvataggio (toast/snackbar)
- Loading state durante il salvataggio

