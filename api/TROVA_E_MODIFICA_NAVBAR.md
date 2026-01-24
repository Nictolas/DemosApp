# Come Trovare e Modificare la Navbar

## 🔍 Passo 1: Trova il Progetto Flutter

Il progetto Flutter probabilmente si trova in una directory separata dalla cartella `api`. Cerca:

1. **Nella directory padre**: `DemosApp-1/` potrebbe contenere una cartella come:
   - `app/`
   - `mobile/`
   - `flutter/`
   - `lib/`
   - O una cartella con il nome del progetto Flutter

2. **Cerca file `pubspec.yaml`**: Questo file indica la presenza di un progetto Flutter
   - Apri la directory che contiene `pubspec.yaml`
   - La navbar si trova probabilmente in `lib/`

## 🔍 Passo 2: Trova il File della Navbar

Una volta trovato il progetto Flutter, cerca il file che contiene la navbar:

### Metodo 1: Cerca per nome
Cerca file con nomi come:
- `main.dart`
- `home_screen.dart` o `home_page.dart`
- `navigation.dart` o `nav.dart`
- `menu.dart` o `drawer.dart`
- `bottom_nav.dart` o `bottom_navigation.dart`

### Metodo 2: Cerca per contenuto
Cerca file che contengono queste parole chiave:
- `BottomNavigationBar`
- `Drawer(`
- `AppBar(` con `actions:`
- `Scaffold(` con `bottomNavigationBar:`

## 📝 Passo 3: Aggiungi il Pulsante Bacheca

Una volta trovato il file, aggiungi il pulsante seguendo questi esempi:

### Se trovi `BottomNavigationBar`:

```dart
BottomNavigationBar(
  items: [
    // ... altri items esistenti
    BottomNavigationBarItem(  // ← AGGIUNGI QUESTO
      icon: Icon(Icons.dashboard),
      label: 'Bacheca',
    ),
    // ... altri items
  ],
  onTap: (index) {
    // ... codice esistente
    if (index == /* indice del pulsante Bacheca */) {
      Navigator.pushNamed(context, '/bacheca');
    }
  },
)
```

### Se trovi `Drawer`:

```dart
Drawer(
  child: ListView(
    children: [
      // ... altri items esistenti
      ListTile(  // ← AGGIUNGI QUESTO
        leading: Icon(Icons.dashboard),
        title: Text('Bacheca'),
        onTap: () {
          Navigator.pop(context);
          Navigator.pushNamed(context, '/bacheca');
        },
      ),
      // ... altri items
    ],
  ),
)
```

### Se trovi `AppBar` con `actions`:

```dart
AppBar(
  title: Text('Titolo'),
  actions: [
    // ... altre azioni esistenti
    IconButton(  // ← AGGIUNGI QUESTO
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

## ✅ Passo 4: Aggiungi la Route

Assicurati di avere la route `/bacheca` nel file delle route (solitamente `main.dart`):

```dart
import 'pages/bacheca-page.dart';  // Assicurati che il percorso sia corretto

// Nelle routes:
routes: {
  '/bacheca': (context) => BachecaPage(),
  // ... altre route
},
```

## 🎯 Checklist Finale

- [ ] Trovato il progetto Flutter
- [ ] Trovato il file della navbar
- [ ] Aggiunto il pulsante "Bacheca" nella navbar
- [ ] Aggiunta la route `/bacheca` nel file delle route
- [ ] Copiato `bacheca-page.dart` nella cartella `lib/pages/` del progetto Flutter
- [ ] Configurato l'autenticazione in `bacheca-page.dart`
- [ ] Testato che il pulsante funzioni

## 💡 Suggerimento

Se non riesci a trovare il file della navbar:

1. **Apri il progetto Flutter in un editor** (VS Code, Android Studio, ecc.)
2. **Cerca** (Ctrl+Shift+F o Cmd+Shift+F) la parola `BottomNavigationBar` o `Drawer`
3. **Apri il file** che contiene questi widget
4. **Segui gli esempi sopra** per aggiungere il pulsante

## 📞 Se hai bisogno di aiuto

Se mi fornisci:
- Il percorso del file della navbar
- O il contenuto del file della navbar

Posso modificarlo direttamente per te!
