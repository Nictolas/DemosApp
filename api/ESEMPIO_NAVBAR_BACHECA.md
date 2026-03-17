# Esempio Navbar con Pulsante Bacheca

Questo file mostra come aggiungere il pulsante "Bacheca" nella navbar del tuo progetto Flutter.

## 📍 Dove aggiungere il codice

Devi trovare il file che contiene la navbar principale della tua app. Solitamente si trova in uno di questi file:
- `lib/main.dart`
- `lib/screens/home_screen.dart`
- `lib/pages/home_page.dart`
- `lib/widgets/main_navigation.dart`
- `lib/navigation/main_nav.dart`

## 🔧 Esempi di implementazione

### Opzione 1: BottomNavigationBar

Se usi un `BottomNavigationBar`, aggiungi questo item:

```dart
BottomNavigationBar(
  currentIndex: _currentIndex,
  onTap: (index) {
    setState(() {
      _currentIndex = index;
    });
    
    // Navigazione
    switch (index) {
      case 0:
        Navigator.pushNamed(context, '/home');
        break;
      case 1:
        Navigator.pushNamed(context, '/bacheca'); // ← AGGIUNGI QUESTO
        break;
      case 2:
        Navigator.pushNamed(context, '/profilo');
        break;
      // ... altri casi
    }
  },
  items: [
    BottomNavigationBarItem(
      icon: Icon(Icons.home),
      label: 'Home',
    ),
    BottomNavigationBarItem(  // ← AGGIUNGI QUESTO ITEM
      icon: Icon(Icons.dashboard),
      label: 'Bacheca',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.person),
      label: 'Profilo',
    ),
    // ... altri items
  ],
)
```

### Opzione 2: Drawer (Menu laterale)

Se usi un `Drawer`, aggiungi questo `ListTile`:

```dart
Drawer(
  child: ListView(
    children: [
      // ... altri items esistenti
      ListTile(  // ← AGGIUNGI QUESTO
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

### Opzione 3: AppBar con azioni

Se usi pulsanti nell'`AppBar`, aggiungi questo `IconButton`:

```dart
AppBar(
  title: Text('Titolo App'),
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

### Opzione 4: TabBar

Se usi un `TabBar`, aggiungi questo tab:

```dart
TabBar(
  tabs: [
    Tab(icon: Icon(Icons.home), text: 'Home'),
    Tab(icon: Icon(Icons.dashboard), text: 'Bacheca'), // ← AGGIUNGI QUESTO
    Tab(icon: Icon(Icons.person), text: 'Profilo'),
    // ... altri tab
  ],
)
```

E nel `TabBarView`:

```dart
TabBarView(
  children: [
    HomePage(),
    BachecaPage(), // ← AGGIUNGI QUESTO
    ProfilePage(),
    // ... altre pagine
  ],
)
```

## ✅ Checklist

Prima di aggiungere il pulsante, assicurati di:

1. ✅ Avere copiato `bacheca-page.dart` nella cartella `lib/pages/` del tuo progetto Flutter
2. ✅ Avere aggiunto la route `/bacheca` nel file delle route (es. `main.dart`):
   ```dart
   import 'pages/bacheca-page.dart';
   
   routes: {
     '/bacheca': (context) => BachecaPage(),
     // ... altre route
   },
   ```
3. ✅ Avere configurato l'autenticazione nel file `bacheca-page.dart`
4. ✅ Avere verificato l'URL dell'API nel file `bacheca-page.dart`

## 🎯 Passi rapidi

1. **Trova il file della navbar** (cerca `BottomNavigationBar`, `Drawer`, o `AppBar` nel tuo progetto)
2. **Aggiungi il pulsante** usando uno degli esempi sopra
3. **Aggiungi la route** se non l'hai già fatto
4. **Testa** l'app per verificare che il pulsante funzioni

## 💡 Suggerimento

Se non riesci a trovare il file della navbar, cerca nel tuo progetto Flutter:
- File che contengono `BottomNavigationBar`
- File che contengono `Drawer`
- File che contengono `Scaffold` con `appBar` o `bottomNavigationBar`
- Il file `main.dart` che di solito contiene la configurazione principale
