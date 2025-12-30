# Guida Frontend - Pagina Preferenze Notifiche

## Struttura Consigliata

### Route
- **Pagina Notifiche**: `/notifiche`
- **Pagina Preferenze**: `/notifiche/preferenze` o `/impostazioni/notifiche`

### Navigazione
Nella pagina `/notifiche`, aggiungi un pulsante ben visibile:
```
[🔔 Notifiche] [⚙️ Preferenze] (header/toolbar)
```

---

## Layout Consigliato

### Header
```
┌─────────────────────────────────────────┐
│ ← Indietro    Preferenze Notifiche      │
└─────────────────────────────────────────┘
```

### Contenuto

#### Sezione 1: Rappresentanti Istituzionali
```
┌─────────────────────────────────────────┐
│ 📊 Rappresentanti Istituzionali         │
├─────────────────────────────────────────┤
│ 🇪🇺 Eurodeputato          [Toggle ON]   │
│    Notifiche dal tuo eurodeputato      │
│                                         │
│ 🏛️ Senatore              [Toggle OFF]  │
│    Notifiche dal tuo senatore          │
│                                         │
│ 🏛️ Deputato               [Toggle OFF] │
│    Notifiche dal tuo deputato          │
│                                         │
│ 🗺️ Consigliere Regionale  [Toggle OFF] │
│    Notifiche dal tuo consigliere       │
│    regionale                            │
│                                         │
│ 🏘️ Consigliere Comunale   [Toggle ON]  │
│    Notifiche dal tuo consigliere       │
│    comunale                             │
└─────────────────────────────────────────┘
```

#### Sezione 2: Piattaforma
```
┌─────────────────────────────────────────┐
│ 🌐 Piattaforma                          │
├─────────────────────────────────────────┤
│ 📢 Demos                  [Toggle ON]  │
│    Notifiche generali della piattaforma │
│                                         │
│ 👥 Attivisti              [Toggle OFF] │
│    Notifiche da attivisti che segui    │
│                                         │
│ 🏢 Organizzazioni         [Toggle OFF] │
│    Notifiche da organizzazioni che     │
│    segui                                │
└─────────────────────────────────────────┘
```

#### Sezione 3: Altro
```
┌─────────────────────────────────────────┐
│ 📌 Altro                                 │
├─────────────────────────────────────────┤
│ 🎓 Scuola                 [Toggle OFF]  │
│    Notifiche per questioni scolastiche │
│                                         │
│ 🦊 Animali                [Toggle ON]  │
│    Notifiche per avvistamenti di        │
│    animali (volpi, etc)                 │
└─────────────────────────────────────────┘
```

### Footer
```
┌─────────────────────────────────────────┐
│         [💾 Salva Preferenze]           │
└─────────────────────────────────────────┘
```

---

## Implementazione Flutter (Esempio)

```dart
class NotificationPreferencesPage extends StatefulWidget {
  @override
  _NotificationPreferencesPageState createState() => 
      _NotificationPreferencesPageState();
}

class _NotificationPreferencesPageState 
    extends State<NotificationPreferencesPage> {
  Map<String, bool> preferences = {};
  bool isLoading = true;
  bool isSaving = false;

  @override
  void initState() {
    super.initState();
    loadPreferences();
  }

  Future<void> loadPreferences() async {
    try {
      final prefs = await getNotificationPreferences();
      setState(() {
        preferences = prefs;
        isLoading = false;
      });
    } catch (e) {
      // Gestisci errore
      setState(() => isLoading = false);
    }
  }

  Future<void> savePreferences() async {
    setState(() => isSaving = true);
    try {
      await saveNotificationPreferences(preferences);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Preferenze salvate con successo')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore nel salvataggio')),
      );
    } finally {
      setState(() => isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text('Preferenze Notifiche')),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Preferenze Notifiche'),
        leading: IconButton(
          icon: Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        children: [
          _buildSection(
            'Rappresentanti Istituzionali',
            [
              _buildPreference(
                'Eurodeputato',
                'Notifiche dal tuo eurodeputato',
                'eurodeputato',
                Icons.account_balance,
              ),
              _buildPreference(
                'Senatore',
                'Notifiche dal tuo senatore',
                'senatore',
                Icons.account_balance,
              ),
              _buildPreference(
                'Deputato',
                'Notifiche dal tuo deputato',
                'deputato',
                Icons.account_balance,
              ),
              _buildPreference(
                'Consigliere Regionale',
                'Notifiche dal tuo consigliere regionale',
                'consigliere_regionale',
                Icons.map,
              ),
              _buildPreference(
                'Consigliere Comunale',
                'Notifiche dal tuo consigliere comunale',
                'consigliere_comunale',
                Icons.location_city,
              ),
            ],
          ),
          _buildSection(
            'Piattaforma',
            [
              _buildPreference(
                'Demos',
                'Notifiche generali della piattaforma',
                'demos',
                Icons.notifications,
              ),
              _buildPreference(
                'Attivisti',
                'Notifiche da attivisti che segui',
                'attivisti',
                Icons.people,
              ),
              _buildPreference(
                'Organizzazioni',
                'Notifiche da organizzazioni che segui',
                'organizzazioni',
                Icons.business,
              ),
            ],
          ),
          _buildSection(
            'Altro',
            [
              _buildPreference(
                'Scuola',
                'Notifiche per questioni scolastiche',
                'scuola',
                Icons.school,
              ),
              _buildPreference(
                'Animali',
                'Notifiche per avvistamenti di animali',
                'animali',
                Icons.pets,
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: isSaving ? null : savePreferences,
          child: isSaving
              ? CircularProgressIndicator()
              : Text('Salva Preferenze'),
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        ...children,
      ],
    );
  }

  Widget _buildPreference(
    String title,
    String description,
    String key,
    IconData icon,
  ) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(description),
      trailing: Switch(
        value: preferences[key] ?? false,
        onChanged: (value) {
          setState(() {
            preferences[key] = value;
          });
        },
      ),
    );
  }
}
```

---

## Best Practices

1. **Salvataggio Automatico**: Considera di salvare automaticamente quando l'utente cambia una preferenza (con debounce)
2. **Feedback Visivo**: Mostra un indicatore di salvataggio in corso
3. **Gestione Errori**: Gestisci errori di rete e mostra messaggi chiari
4. **Validazione**: Valida i dati prima di inviarli
5. **Accessibilità**: Usa label descrittive e supporta screen reader
6. **Responsive**: Assicurati che funzioni bene su mobile e desktop

