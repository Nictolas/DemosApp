# Guida: pubblicare l’app DEMOS sul Google Play Store

Questa guida spiega come portare l’app **DEMOS** (Capacitor + React) sul Google Play Store: cosa serve, quali modifiche al codice sono necessarie e i passi in Play Console.

---

## 1. Cosa avete già

- **Frontend**: React + Vite in `client/`
- **Android**: progetto Capacitor in `client/android/` (applicationId: `com.demos.app`)
- **Configurazione**: `targetSdkVersion 34`, `minSdkVersion 22`, permesso INTERNET, opzionale Firebase (google-services.json) per le notifiche push

L’app è già predisposta per essere compilata come APK/AAB Android; servono soprattutto configurazione release, firma e contenuti per la scheda Play.

---

## 2. Prerequisiti (nessuna modifica al codice)

### 2.1 Account Google Play Console

- Andate su [Google Play Console](https://play.google.com/console).
- Registrate un **account sviluppatore** (una tantum, circa 25 €).
- Accettate l’accordo per gli sviluppatori.

### 2.2 Keystore per la firma (obbligatorio)

La prima volta create un keystore e usatelo **sempre** per le release; se lo perdete non potrete più aggiornare l’app con lo stesso applicationId.

**Creazione keystore (una sola volta):**

```bash
keytool -genkey -v -keystore demos-release-key.keystore -alias demos -keyalg RSA -keysize 2048 -validity 10000
```

- Salvate `demos-release-key.keystore` e la password in un posto sicuro (es. gestore password).
- **Non** committare il file `.keystore` nel repository (aggiungetelo a `.gitignore`).

---

## 3. Modifiche al codice / progetto

Queste sono le cose da **controllare o aggiungere** nel vostro repo.

### 3.1 Versione dell’app (obbligatorio per ogni release)

In **`client/android/app/build.gradle`** avete già:

- `versionCode` (numero intero, deve crescere a ogni upload)
- `versionName` (stringa visibile all’utente, es. `"1.0"`)

Ad ogni nuova release:

- Incrementate `versionCode` (es. 1 → 2 → 3).
- Aggiornate `versionName` se volete (es. `"1.0"` → `"1.1"`).

Esempio:

```gradle
defaultConfig {
    applicationId "com.demos.app"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 2
    versionName "1.1"
    // ...
}
```

Consiglio: in futuro potete generare `versionCode` da data o da CI (es. build number).

### 3.2 Nome e icona

- **Nome app**: già impostato in `client/android/app/src/main/res/values/strings.xml` (`app_name`: DEMOS) e in `capacitor.config.ts` (`appName: 'DEMOS'`). Va bene; se lo cambiate, allineate entrambi.
- **Icona**: le icone sono in `client/android/app/src/main/res/mipmap-*` e `drawable`. Per il Play Store è consigliato avere almeno un’icona 512x512 (per la scheda dello store). Potete generare le densità da un’immagine alta risoluzione con strumenti come [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html).

Nessuna modifica obbligatoria se nome e icona già vi piacciono.

### 3.3 Privacy policy (obbligatoria se raccogliete dati)

Se l’app raccoglie dati personali (account, email, preferenze, notifiche push, ecc.) Google richiede un **URL alla privacy policy** pubblico e leggibile.

- Se avete già una pagina (es. sul sito di DEMOS), usate quell’URL nella scheda “Norme sulla privacy” in Play Console.
- Se non l’avete ancora:
  - Aggiungete una pagina “Privacy” nel sito (o nella web app) con testo chiaro (cosa raccogliete, come, finalità, diritti utente, contatti).
  - Inserite l’URL in Play Console quando create/ Modificate l’app.

Non serve modificare il codice dell’app Android per “mettere” la policy: basta che l’URL sia raggiungibile dal browser.

### 3.4 Target SDK e permessi

- **targetSdkVersion 34**: va bene per le policy attuali del Play Store.
- **Permessi**: in `AndroidManifest.xml` avete solo `INTERNET`; se usate notifiche push (FCM) le dipendenze sono già nel `build.gradle` (google-services). Non servono altre modifiche ai permessi per una prima pubblicazione, a meno che non aggiungiate funzioni che richiedono nuovi permessi (es. posizione, fotocamera).

### 3.5 Riepilogo modifiche minime per la prima release

| Cosa | Dove | Obbligatorio |
|------|------|--------------|
| `versionCode` / `versionName` | `client/android/app/build.gradle` | Sì (incrementare a ogni release) |
| Nome app | `strings.xml` + `capacitor.config.ts` | Già fatto |
| Icona 512x512 | Per scheda Play Store | Consigliato |
| Privacy policy (URL) | Play Console (non nel codice) | Sì se raccogliete dati |

Non è strettamente necessario modificare altro nel codice per “mettere l’app sullo store”; il resto è build, firma e compilazione della scheda in Play Console.

---

## 4. Build di release (AAB consigliato)

Google preferisce l’upload in formato **Android App Bundle (AAB)** invece dell’APK.

### 4.1 Configurare la firma in Gradle

Create (se non esiste) il file **`client/android/keystore.properties`** (e aggiungetelo a `.gitignore`):

```properties
storePassword=LA_TUA_PASSWORD_KEYSTORE
keyPassword=LA_TUA_PASSWORD_KEY
keyAlias=demos
storeFile=../demos-release-key.keystore
```

Il path `storeFile` può essere relativo alla cartella `android/` (ad esempio mettete il `.keystore` in `client/` e usate `../demos-release-key.keystore` come sopra).

Modificate **`client/android/app/build.gradle`** per usare il keystore in release:

- In cima al file (dopo `apply plugin: 'com.android.application'`), aggiungete:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

- Nella sezione `android { ... }`, aggiungete un blocco `signingConfigs` e riferitelo in `buildTypes.release`:

```gradle
android {
    namespace "com.demos.app"
    compileSdk rootProject.ext.compileSdkVersion

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }

    defaultConfig {
        applicationId "com.demos.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        // ... resto invariato
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

(Adattate `versionCode`/`versionName` come in § 3.1.)

### 4.2 Generare il bundle (AAB)

Dalla root del progetto (dove c’è `client/`):

```bash
cd client
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

L’AAB sarà in:  
`client/android/app/build/outputs/bundle/release/app-release.aab`.

Questo file è quello da caricare in Play Console (non l’APK, a meno che non usiate “Internal testing” con APK).

---

## 5. Google Play Console: creare l’app e compilare la scheda

### 5.1 Crea app

- In Play Console: **Crea app** → nome “DEMOS”, lingua principale, tipo app (App o Giochi), gratuita/a pagamento.
- Compilate **Norme sulla privacy**: inserite l’URL della privacy policy (obbligatorio se l’app raccoglie dati).

### 5.2 Contenuti obbligatori della scheda

- **Descrizione breve** (max 80 caratteri).
- **Descrizione completa** (max 4000 caratteri).
- **Screenshot**: almeno 2 (telefono); dimensioni consigliate 320–3840 px sul lato corto. Potete usare un emulatore o uno smartphone dopo `cap run android`.
- **Icona 512x512**: per la scheda dello store (non per l’installazione sul dispositivo).
- **Grafica in evidenza** (opzionale ma consigliata): 1024x500 px.

### 5.3 Categorie e questionari

- **Categoria app** (es. “Politica” o “Notizie e riviste”).
- **Questionario contenuti**: indicare se l’app è per bambini, se contiene annunci, acquisti in-app, ecc.
- **Questionario sulla sicurezza**: descrivere come gestite i dati (login, backup, trasmissione).

### 5.4 Invio in revisione

- Andate in **Release** → **Produzione** (o **Test interni** per una prima prova).
- Create una nuova release e **caricate l’AAB** (`app-release.aab`).
- Inserite le **note di rilascio** (cosa c’è di nuovo in questa versione).
- Inviate in revisione. I tempi di revisione sono tipicamente da qualche ora a qualche giorno.

---

## 6. Checklist pre-pubblicazione

- [ ] Account Google Play Developer attivo
- [ ] Keystore creato e salvato in modo sicuro; `keystore.properties` in `.gitignore`
- [ ] `versionCode` e `versionName` impostati in `client/android/app/build.gradle`
- [ ] Privacy policy pubblicata e URL inserito in Play Console
- [ ] Build AAB: `npm run build` → `cap sync android` → `./gradlew bundleRelease`
- [ ] Screenshot e icona 512x512 preparati
- [ ] Descrizioni e note di rilascio scritte in Play Console
- [ ] AAB caricato e release inviata in revisione

---

## 7. Aggiornamenti futuri

Per ogni nuova versione:

1. Incrementate `versionCode` (e opzionalmente `versionName`) in `client/android/app/build.gradle`.
2. Ricostruite: `npm run build` → `cap sync android` → `./gradlew bundleRelease`.
3. In Play Console: nuova release (produzione o test), caricare il nuovo AAB, note di rilascio, invio in revisione.

Se volete, nel prossimo passo possiamo applicare insieme le modifiche a `build.gradle` e creare il file `keystore.properties.example` (senza password) per il team.
