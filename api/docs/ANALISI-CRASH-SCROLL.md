# Analisi crash durante lo scroll nell’app

Documento di analisi delle cause dei crash quando l’utente scrolla tra le pagine e degli interventi applicati.

---

## 1. Cause principali identificate

### 1.1 Re-render a ogni scroll (RobustAppLayout) — **CRITICO**

**Comportamento:**  
Il layout globale (`RobustAppLayout`) ascolta l’evento `scroll` sul contenitore `.app-main`. A ogni frame (throttle con `requestAnimationFrame`) veniva chiamato `setIsNavbarVisible(...)` per mostrare/nascondere la navbar.

**Problemi:**

1. **Re-render dell’intero albero**  
   Ogni `setState` in `RobustAppLayout` fa ri-renderizzare il layout e **tutti i figli** (la pagina corrente). Con pagine pesanti (es. Notifiche con decine di `NotificaItem`, Voti Parlamento con molte Card) si hanno decine/centinaia di componenti che si ri-renderizzano più volte al secondo durante lo scroll → carico CPU e memoria elevato, rischio di jank, OOM o chiusura tab su mobile.

2. **setState dopo unmount**  
   Il callback passato a `requestAnimationFrame` poteva essere eseguito **dopo** che l’utente aveva già cambiato pagina. In quel caso il componente era già smontato e la chiamata a `setIsNavbarVisible` diventava un “setState on unmounted component” → warning React e possibile instabilità/crash.

**Correzioni applicate (in `RobustAppLayout.tsx`):**

- **setState solo quando la visibilità cambia:**  
  Si mantiene l’ultimo valore in un ref (`lastNavbarVisibleRef`). Si calcola il nuovo valore (`nextVisible`) e si chiama `setIsNavbarVisible(nextVisible)` **solo se** `nextVisible !== lastNavbarVisibleRef.current`.  
  In questo modo i re-render avvengono solo quando la navbar passa davvero da visibile a nascosta (o viceversa), non a ogni frame.

- **Nessun setState dopo unmount:**  
  Ref `isMountedRef` impostato a `true` al mount e a `false` nel cleanup dell’effect. Nel callback di `requestAnimationFrame` si controlla `isMountedRef.current` prima di chiamare `setState`.  
  Nel cleanup si annulla anche l’eventuale `requestAnimationFrame` pendente (`cancelAnimationFrame(rafIdRef.current)`).

Risultato: durante lo scroll si evitano re-render inutili e si evita del tutto il setState dopo unmount.

---

### 1.2 Nessun Error Boundary — **ALTO**

**Problema:**  
Non era presente alcun Error Boundary. Un errore non gestito durante il render (o in un lifecycle) di un componente figlio faceva propagare l’errore e poteva far cadere l’intera app (schermata bianca / crash).

**Perché lo scroll peggiora la situazione:**  
Lo scroll può causare molti re-render (soprattutto prima della fix sopra). Più re-render ci sono, più aumenta la probabilità di incrociare uno stato inconsistente o un bug che lancia un’eccezione. Senza Error Boundary, un solo errore in una pagina poteva far crashare tutto.

**Correzione applicata:**

- Aggiunto il componente **`ErrorBoundary`** (class component con `componentDidCatch` / `getDerivedStateFromError`).
- Il contenuto principale è avvolto in `<ErrorBoundary>` dentro `RobustAppLayout` (nel `<main className="app-main">`).
- In caso di errore viene mostrata una UI di fallback (“Qualcosa è andato storto”) con pulsanti “Riprova” e “Ricarica pagina”, senza far cadere l’intera applicazione.

---

### 1.3 Liste lunghe senza virtualizzazione — **MEDIO** (da considerare in seguito)

**Situazione:**  
Diverse pagine renderizzano elenchi lunghi con un semplice `.map()` su tutti gli elementi:

- **Notifiche:** `ListaNotifiche` → `data.notifiche.map` → ogni elemento è un `NotificaItem` (con Dialog, useQuery, stato locale).
- **Voti Parlamento:** `votazioniCamera.map` e `votazioniSenato.map` → molte Card con contenuto ricco.
- **Voti Politici, Iniziative popolari, Referendum, Preferiti, Sostenitori, ecc.:** stesso schema.

**Problemi:**

- Tutti i nodi DOM e i componenti React sono montati insieme. Con 50–100+ elementi si hanno migliaia di nodi DOM e molte istanze di componenti.
- Prima della fix dello scroll, ogni movimento dello scroll poteva ri-renderizzare tutti questi componenti (per il `setState` nel layout), moltiplicando il carico.
- Su dispositivi con poca memoria (mobile) si può arrivare a uso di memoria molto alto e, in casi estremi, a kill del tab da parte del sistema.

**Raccomandazione (non ancora implementata):**  
Introducire **virtualizzazione** (es. `react-window`, `@tanstack/react-virtual`) per le liste più lunghe (Notifiche, Voti Parlamento, ecc.) in modo da montare e renderizzare solo gli elementi visibili (o poco oltre). Questo ridurrebbe nodi DOM e lavoro di reconciliation durante lo scroll.

---

### 1.4 NotificaItem e query per singolo elemento

**Situazione:**  
Se la pagina Notifiche non passa i dati batch (`reazioniMap` / `userReazioniMap`) in tempo, ogni `NotificaItem` può usare `usePerItemQueries === true` e quindi 2 `useQuery` per notifica (reazioni + reazione utente). Con N notifiche si arrivano a 2N query.

**Stato:**  
La pagina Notifiche già usa gli endpoint batch e passa `reazioniMap` e `userReazioniMap` a `ListaNotifiche`/`NotificaItem`. Quindi in condizioni normali `hasBatchData` è true e non si fanno query per singolo item. Il rischio rimane in casi di caricamento lento o race: in quel caso si possono ancora avere molte query.  
Valutare in futuro: mostrare uno stato di caricamento finché i batch non sono pronti, così che gli item non montino mai in modalità “per-item”.

---

### 1.5 Scroll annidati e CSS

**Situazione:**  
In alcune pagine (es. Notifiche) c’è uno scroll esterno (`.app-main`) e uno interno (`div` con `overflow-y-auto` che contiene la lista). In più, in `index.css` e `robust-layout.css` ci sono molte regole su `overflow`, `overscroll-behavior`, `touch-action`.

**Rischio:**  
Su alcuni browser/dispositivi, scroll annidati e regole aggressive possono generare comportamenti strani (scroll che “blocca”, rimbalzi). Non è stata identificata una causa diretta di crash, ma può contribuire a una sensazione di instabilità.  
Se dopo le fix principali persistono problemi su dispositivi specifici, conviene rivedere quale elemento è effettivamente lo scroll principale e semplificare le regole CSS laddove possibile.

---

## 2. Riepilogo interventi effettuati

| Intervento | File | Descrizione |
|------------|------|-------------|
| Scroll handler sicuro e riduzione re-render | `client/src/components/RobustAppLayout.tsx` | setState solo quando cambia la visibilità navbar; ref per unmount e cancel di requestAnimationFrame; nessun setState dopo unmount. |
| Error Boundary | `client/src/components/ErrorBoundary.tsx` (nuovo) | Componente che cattura errori in render/lifecycle e mostra fallback con “Riprova” / “Ricarica pagina”. |
| Uso dell’Error Boundary nel layout | `client/src/components/RobustAppLayout.tsx` | Contenuto di `<main class="app-main">` avvolto in `<ErrorBoundary>`. |

---

## 3. Cosa fare se i crash da scroll continuano

1. **Confermare che le fix sono in build:**  
   Verificare che l’app in produzione (o in staging) usi la versione aggiornata di `RobustAppLayout` e `ErrorBoundary`.

2. **Virtualizzazione liste:**  
   Prioritariamente su Notifiche e Voti Parlamento (e, se necessario, altre liste lunghe), introdurre una lista virtualizzata.

3. **Logging lato client:**  
   In sviluppo, in `ErrorBoundary` è possibile usare `onError` per inviare errori a un servizio (es. Sentry) e capire quali componenti/pagine falliscono più spesso durante lo scroll.

4. **Ridurre lavoro nelle liste:**  
   Per ogni item delle liste (es. `NotificaItem`): evitare re-render inutili con `React.memo`, evitare oggetti/funzioni nuovi a ogni render (useCallback/useMemo dove serve), e assicurarsi che i dati batch siano sempre passati per evitare N query per item.

5. **Monitorare memoria e performance:**  
   Su dispositivi reali (in particolare mobile) usare DevTools / strumenti di profiling per verificare picchi di memoria e frame drop durante lo scroll; le fix sopra dovrebbero già ridurre in modo netto i re-render durante lo scroll.

---

## 4. Riferimenti nel codice

- Layout e scroll: `client/src/components/RobustAppLayout.tsx`
- Error Boundary: `client/src/components/ErrorBoundary.tsx`
- Lista notifiche (nessuna virtualizzazione): `client/src/pages/Notifiche/components/ListaNotifiche.tsx`
- Item notifica (pesante, con query e dialog): `client/src/pages/Notifiche/components/NotificaItem.tsx`
- Layout e overflow: `client/src/robust-layout.css`, `client/src/index.css`
