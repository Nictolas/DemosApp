# Funzionalità "Aggiungi a Schermata Home" - DEMOS PWA

## Panoramica

È stata implementata la funzionalità "Aggiungi a Schermata Home" per permettere agli utenti di installare DEMOS come Progressive Web App (PWA) sui loro dispositivi mobili.

## Componenti Implementati

### 1. Hook `usePWAInstall` (`client/src/hooks/usePWAInstall.ts`)
- Gestisce la logica di installazione PWA
- Rileva se l'app è installabile o già installata
- Fornisce funzioni per installare l'app o mostrare istruzioni

### 2. Pulsante nella Landing Page (`client/src/pages/LandingPage.tsx`)
- Pulsante "Aggiungi a Schermata Home" visibile solo su dispositivi mobili
- Appare solo se l'app non è installata
- Icona dinamica (Download per installazione automatica, Smartphone per istruzioni)
- Stile coerente con il design dell'app

### 3. Banner PWA (`client/src/components/PWAInstallBanner.tsx`)
- Banner informativo che appare solo su dispositivi mobili
- Appare dopo 3 secondi se l'app non è installata
- Può essere chiuso dall'utente
- Ricorda la preferenza dell'utente nel localStorage
- Posizionato in basso a schermo intero su mobile

### 4. Service Worker (`client/public/sw.js`)
- Cache delle risorse principali per funzionamento offline
- Gestione delle richieste di rete
- Registrazione automatica all'avvio dell'app

## Funzionalità

### Installazione Automatica
- Su browser supportati (Chrome, Edge, Safari), l'utente può installare l'app direttamente
- Il pulsante cambia icona e comportamento in base alla disponibilità dell'installazione

### Istruzioni Manuali
- Su browser non supportati o iOS Safari, vengono mostrate istruzioni specifiche
- Istruzioni personalizzate per iOS, Android e browser generici

### Rilevamento Installazione
- L'app rileva automaticamente se è già installata
- Nasconde i pulsanti di installazione se l'app è già presente nella schermata home

## Configurazione PWA

### Manifest (`client/public/manifest.json`)
- Configurazione completa per PWA
- Icone multiple per diverse dimensioni
- Tema e colori personalizzati
- Orientamento portrait per mobile

### Meta Tag HTML (`client/index.html`)
- Configurazione per iOS (Apple Touch Icons)
- Configurazione per Android
- Meta tag per Microsoft Edge
- Viewport ottimizzato per mobile

## Esperienza Utente

### Su Desktop
- Nessun elemento PWA visibile (funzionalità mobile-only)
- L'app funziona normalmente come sito web

### Su Mobile
- Banner in basso a schermo intero (dopo 3 secondi)
- Pulsante prominente nella landing page
- Istruzioni specifiche per ogni piattaforma
- Installazione diretta o tramite istruzioni

## Browser Supportati

### Installazione Automatica
- Chrome (Android, Desktop)
- Edge (Android, Desktop)
- Safari (iOS 11.3+)

### Istruzioni Manuali
- Safari (iOS) - tramite "Aggiungi a Home"
- Firefox (Android) - tramite menu browser
- Altri browser - istruzioni generiche

## Note Tecniche

- Il service worker viene registrato automaticamente all'avvio
- La cache viene gestita automaticamente
- Il banner può essere disabilitato dall'utente
- Compatibile con il sistema di autenticazione esistente

## Test

Per testare la funzionalità:
1. Aprire l'app su un dispositivo mobile
2. Verificare che il banner appaia dopo 3 secondi
3. Testare l'installazione su diversi browser
4. Verificare che l'app funzioni in modalità standalone dopo l'installazione
