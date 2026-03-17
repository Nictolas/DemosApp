# Setup Capacitor per DEMOS

Capacitor è stato configurato con successo per permettere la creazione di app native Android (e in futuro iOS).

## ✅ Cosa è stato configurato

- ✅ Capacitor Core e CLI installati
- ✅ Plugin Haptics installato (per la vibrazione)
- ✅ Piattaforma Android aggiunta
- ✅ Configurazione base completata

## 📱 Funzionalità Vibrazione

La vibrazione ora funzionerà:
- ✅ **App Android nativa (APK)**: Funziona perfettamente tramite Capacitor Haptics
- ✅ **Android Chrome/Edge (web)**: Funziona tramite API Vibration del browser
- ❌ **iPhone/Safari (web)**: Non funziona (limitazione Safari)

## 🚀 Come creare l'APK Android

### Prerequisiti
1. Installa Android Studio: https://developer.android.com/studio
2. Installa Java JDK 11 o superiore
3. Configura le variabili d'ambiente ANDROID_HOME

### Passaggi

1. **Costruisci l'app web:**
   ```bash
   cd client
   npm run build
   ```

2. **Sincronizza con Android:**
   ```bash
   npm run cap:sync android
   ```
   Oppure usa il comando combinato:
   ```bash
   npm run android:sync
   ```

3. **Apri Android Studio:**
   ```bash
   npm run android:open
   ```
   Oppure:
   ```bash
   npm run cap:open android
   ```

4. **In Android Studio:**
   - Attendi che Gradle finisca la sincronizzazione
   - Collega un dispositivo Android o avvia un emulatore
   - Clicca su "Run" (▶️) per compilare e installare l'app

### Comandi disponibili

- `npm run build` - Costruisce l'app web
- `npm run cap:sync` - Sincronizza tutte le piattaforme
- `npm run cap:sync android` - Sincronizza solo Android
- `npm run cap:open android` - Apre Android Studio
- `npm run android:sync` - Build + Sync Android (comando combinato)
- `npm run android:open` - Apre Android Studio

## 📝 Note importanti

1. **Prima di ogni build**: Esegui sempre `npm run build` per generare i file web aggiornati
2. **Sincronizzazione**: Dopo ogni modifica al codice, esegui `npm run cap:sync android`
3. **Plugin**: Il plugin Haptics è già configurato e funzionerà automaticamente nell'app nativa

## 🔧 Configurazione

Il file `capacitor.config.ts` contiene la configurazione base:
- **appId**: `com.demos.app`
- **appName**: `DEMOS`
- **webDir**: `dist` (dove Vite genera i file)

## 📦 File generati

- `android/` - Progetto Android nativo (non committare se troppo grande)
- `capacitor.config.ts` - Configurazione Capacitor

## 🎯 Prossimi passi (opzionale)

Per aggiungere anche iOS:
```bash
npm install @capacitor/ios
npm run cap:add ios
```

## 🐛 Troubleshooting

**Errore "Could not find installation of TypeScript"**
- TypeScript è già installato, ma se persiste: `npm install -D typescript`

**Errore Gradle**
- Apri Android Studio e lascia che sincronizzi Gradle automaticamente

**Vibrazione non funziona nell'APK**
- Verifica che il plugin Haptics sia installato: `npm list @capacitor/haptics`
- Controlla i log di Android Studio per errori

