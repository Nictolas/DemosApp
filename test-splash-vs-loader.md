# Test Splash Screen vs Caricatori

## Modifiche Implementate

### 1. Splash Screen (AppWrapper.tsx)
- **Quando appare**: Solo al primo caricamento dell'app o dopo un login
- **Durata**: 2 secondi (ridotta da 8)
- **Controllo**: Usa `sessionStorage` per evitare di mostrarlo ad ogni navigazione
- **Condizioni**:
  - Primo caricamento dell'app (`!sessionStorage.getItem('app_loaded')`)
  - Utente ha un token (login recente)
  - Non è già stato mostrato in questa sessione

### 2. Caricatori Estetici (PageTransition)
- **Quando appaiono**: Solo per pagine che fanno chiamate API pesanti
- **Durata**: 500ms
- **Pagine con caricatori**:
  - `/ice` - Iniziative di Cittadinanza Europea
  - `/iniziative-popolari` - Iniziative Popolari
  - `/referendum-abrogativi` - Referendum Abrogativi
  - `/proponi-opinione` - Proponi Opinione
  - `/capo-stato` - Capo di Stato
  - `/grazia` - Grazia
  - `/utenti` - Gestione Utenti

### 3. Pagine Senza Caricatori
- Tutte le altre pagine (menu, profilo, impostazioni, ecc.) non mostrano caricatori
- Hanno solo transizioni fluide senza loader

## Test da Eseguire

1. **Primo caricamento**: Aprire l'app → Dovrebbe mostrare splash screen con logo
2. **Navigazione normale**: Andare da menu a profilo → Nessun caricatore, solo transizione
3. **Pagine con API**: Andare a ICE/Iniziative → Dovrebbe mostrare caricatore estetico
4. **Login**: Fare login → Dovrebbe mostrare splash screen
5. **Navigazione dopo login**: Navigare tra pagine → Solo transizioni, no splash screen

## Risultato Atteso
- Splash screen: Solo per primo caricamento e login
- Caricatori: Solo per pagine che caricano dati pesanti
- Transizioni fluide: Per tutte le altre navigazioni
