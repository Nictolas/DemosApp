# DPIA - Data Protection Impact Assessment

> **Avviso tecnico (30/10/2026): DPIA storica NON APPROVATA per il rilascio corrente.** Il contenuto sottostante conserva affermazioni e periodi da riconciliare; parere DPO e firme risultano non compilati. Non usare questo documento come attestazione GDPR. Vedere la [matrice di riconciliazione e prove mancanti](docs/privacy/DPIA_RELEASE_RECONCILIATION_2026-10-30.md).\n\n## Valutazione d'Impatto sulla Protezione dei Dati

**Applicazione:** DemosApp - Piattaforma di Democrazia Partecipativa Digitale  
**Titolare del Trattamento:** Democracy Institute APS  
**Versione Documento:** 1.1  
**Data:** 20 Febbraio 2026 (rev. 16/03/2026)  
**Responsabile:** Nicolas Micheletti (Presidente)  
**DPO:** Mattia Picariello – mattia.picariello@hotmail.it  

---

## Sommario

1. [Introduzione e Contesto](#1-introduzione-e-contesto)
2. [Descrizione del Trattamento](#2-descrizione-del-trattamento)
3. [Necessità della DPIA](#3-necessità-della-dpia)
4. [Valutazione della Necessità e Proporzionalità](#4-valutazione-della-necessità-e-proporzionalità)
5. [Identificazione e Valutazione dei Rischi](#5-identificazione-e-valutazione-dei-rischi)
6. [Misure di Mitigazione](#6-misure-di-mitigazione)
7. [Parere del DPO](#7-parere-del-dpo)
8. [Piano di Attuazione](#8-piano-di-attuazione)
9. [Conclusioni e Approvazione](#9-conclusioni-e-approvazione)
10. [Allegati](#10-allegati)

---

## 1. Introduzione e Contesto

### 1.1 Scopo del Documento

La presente Valutazione d'Impatto sulla Protezione dei Dati (DPIA) è redatta ai sensi dell'**Art. 35 del Regolamento UE 2016/679 (GDPR)** per valutare i rischi derivanti dal trattamento dei dati personali effettuato dalla piattaforma **DemosApp**.

### 1.2 Titolare del Trattamento

Il **Titolare del Trattamento** è l'associazione **Democracy Institute APS**, rappresentata dal suo Presidente in veste di legale rappresentante.

| Campo | Valore |
|-------|--------|
| **Titolare del Trattamento** | Democracy Institute APS |
| **Rappresentante Legale** | Nicolas Micheletti (in qualità di Presidente) |
| **Sede Legale** | Via Che Guevara 135, 56017 San Giuliano Terme (PI) |
| **P.IVA / C.F.** | [Inserisci il CF dell'Associazione che otterrai all'Agenzia delle Entrate] |
| **Contatto Privacy** | [Es. privacy@democracyinstitute.it] |
| **DPO** | Mattia Picariello – mattia.picariello@hotmail.it |

**Forma giuridica:** Associazione di Promozione Sociale (APS) - Ente del Terzo Settore.  
*(Iscrizione RUNTS: da inserire se già iscritta.)*

**Valutazione obbligo DPO (Art. 37 GDPR):**

| Criterio Art. 37 | Applicabilità | Note |
|------------------|---------------|------|
| Autorità/organismo pubblico | NO | Titolare è APS (ente privato) |
| Monitoraggio sistematico su larga scala | PARZIALE | Tracciamento voti e opinioni |
| **Trattamento larga scala dati Art. 9** | **SÌ** | **Opinioni politiche = dato sensibile** |

**Conclusione:** Il DPO è stato nominato (Mattia Picariello). La nomina resta **obbligatoria** o fortemente raccomandata per il trattamento di dati ex Art. 9; il contratto di nomina DPO è obbligatorio (vedi Allegato G per i contenuti minimi).  

### 1.3 Descrizione del Progetto

DemosApp è una **piattaforma di democrazia partecipativa digitale** che consente ai cittadini di:

- Esprimere voti per Capo di Stato, Referendum, Iniziative Popolari e ICE (Iniziativa dei Cittadini Europei)
- Manifestare opinioni su temi politici e sociali
- Comunicare attraverso una bacheca pubblica
- Gestire rappresentanti e candidati politici
- Interagire con istituzioni governative

### 1.4 Architettura Tecnica

| Componente | Tecnologia | Hosting |
|------------|------------|---------|
| Backend API | Node.js + Express | Render.com |
| Frontend Web | React + Vite + Tailwind CSS | Render.com (sito statico) |
| Applicazione Mobile | Capacitor (Android) | Google Play Store |
| Database | PostgreSQL | Supabase |
| Notifiche Push | Firebase Cloud Messaging | Google Firebase |
| Email Transazionali | Resend | Cloud |
| Logging e Audit | Axiom | Cloud |

---

## 2. Descrizione del Trattamento

### 2.1 Categorie di Interessati

| Categoria | Descrizione | Stima Numerica |
|-----------|-------------|----------------|
| Elettori | Utenti registrati con diritto di voto | [Da quantificare] |
| Politici | Utenti con ruolo politico attivo | [Da quantificare] |
| Candidati | Utenti candidati a cariche elettive | [Da quantificare] |
| Attivisti | Utenti con ruolo di attivismo | [Da quantificare] |
| Istituzioni | Account istituzionali | [Da quantificare] |
| Amministratori | Personale tecnico/amministrativo | [Da quantificare] |

### 2.2 Categorie di Dati Personali Trattati

#### 2.2.1 Dati Identificativi (Art. 6 GDPR)

| Dato | Finalità | Base Giuridica |
|------|----------|----------------|
| Email | Identificazione, comunicazioni | Contratto |
| Nome e Cognome | Identificazione | Contratto |
| Codice Fiscale (CIE) | Autenticazione sicura | Contratto |
| Password (hash) | Accesso sicuro | Contratto |

#### 2.2.2 Dati Anagrafici (Art. 6 GDPR)

| Dato | Finalità | Base Giuridica |
|------|----------|----------------|
| Data di Nascita | Verifica maggiore età, statistiche | Contratto |
| Genere | Statistiche demografiche | Consenso |
| Cittadinanza | Determinazione diritti elettorali | Contratto |

#### 2.2.3 Dati di Residenza (Art. 6 GDPR)

| Dato | Finalità | Base Giuridica |
|------|----------|----------------|
| Paese, Regione, Provincia, Comune | Determinazione circoscrizione elettorale | Contratto |

#### 2.2.4 Dati Elettorali (Art. 6 GDPR)

| Dato | Finalità | Base Giuridica |
|------|----------|----------------|
| Grado di elezione | Determinazione competenze di voto | Contratto |
| Circoscrizione elettorale | Assegnazione votazioni | Contratto |
| Rappresentanti selezionati | Funzionalità piattaforma | Contratto |

#### 2.2.5 ⚠️ DATI SENSIBILI - Opinioni Politiche (Art. 9 GDPR)

**ATTENZIONE: Questa categoria richiede consenso esplicito e specifico**

I temi su cui gli utenti esprimono opinioni sono **definiti e aggiornabili dalla piattaforma** (es. energia nucleare, sperimentazione animale, legalizzazione canapa, caccia, eutanasia, matrimonio egualitario, salario minimo e altri temi di attualità). L'elenco completo e aggiornato dei temi è disponibile nell'app e nell'informativa privacy; la DPIA non richiede di essere modificata ogni volta che un tema viene aggiunto o rimosso.

| Categoria di dato | Finalità | Base Giuridica |
|-------------------|----------|----------------|
| **Opinioni politiche** su temi di attualità (elenco temi configurabile dalla piattaforma) | Aggregazione opinioni collettive, confronto con rappresentanti, funzionamento del servizio | Consenso esplicito Art. 9(2)(a) |
| **Voti espressi** (capo di stato, referendum, iniziative popolari, ICE, amnistia, grazia, ministri, ecc.) | Funzionalità core della piattaforma, partecipazione democratica | Consenso esplicito Art. 9(2)(a) |

#### 2.2.6 Dati Tecnici (Art. 6 GDPR)

| Dato | Finalità | Base Giuridica |
|------|----------|----------------|
| Indirizzo IP | Sicurezza, audit GDPR | Legittimo interesse |
| Token FCM | Notifiche push | Consenso |
| Configurazione avatar | Personalizzazione | Contratto |
| URL social media | Profilo pubblico (opzionale) | Consenso |

### 2.3 Finalità del Trattamento

| ID | Finalità | Base Giuridica | Dati Coinvolti |
|----|----------|----------------|----------------|
| F1 | Gestione account utente | Art. 6(1)(b) - Contratto | Identificativi, anagrafici |
| F2 | Autenticazione e sicurezza | Art. 6(1)(b) - Contratto | Email, password, IP |
| F3 | Determinazione diritti elettorali | Art. 6(1)(b) - Contratto | Residenza, cittadinanza |
| F4 | Raccolta opinioni politiche | Art. 9(2)(a) - Consenso esplicito | Opinioni, voti |
| F5 | Aggregazione statistica | Art. 6(1)(f) - Legittimo interesse | Dati aggregati/anonimi |
| F6 | Comunicazioni di servizio | Art. 6(1)(b) - Contratto | Email |
| F7 | Notifiche push | Art. 6(1)(a) - Consenso | Token FCM |
| F8 | Conformità legale e audit | Art. 6(1)(c) - Obbligo legale | Log, IP |

### 2.4 Modalità di Raccolta

| Modalità | Descrizione | Consenso |
|----------|-------------|----------|
| Registrazione web | Form multi-step: (1) Privacy policy, (2) ToS, (3) Consenso opinioni politiche Art. 9, (4) Cittadinanza, (5–8) Residenza (paese, regione, provincia, comune; provincia e comune obbligatori solo per Italia/San Marino/Svizzera con regione ≠ Estero), poi completamento (creazione passkey o invio form). Il numero di passaggi può variare in base al flusso (passkey/OAuth/email). | Privacy policy, ToS, Opinioni politiche |
| Autenticazione CIE | OIDC con PKCE tramite Carta d'Identità Elettronica | Implicito nell'uso CIE |
| Aggiornamento profilo | Form di modifica dati | Già acquisito |
| Espressione opinioni | Interfacce dedicate per ogni tema | Consenso specifico Art. 9 |
| Votazione | Interfacce di voto | Consenso specifico Art. 9 |

### 2.5 Flussi di Dati

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUSSO DATI DEMOSAPP                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [Utente]                                                          │
│      │                                                              │
│      ▼                                                              │
│   [Frontend Web/Mobile]                                             │
│      │                                                              │
│      │ HTTPS/TLS 1.3                                                │
│      ▼                                                              │
│   [Backend API - Render.com]                                        │
│      │                                                              │
│      ├──────────────────┬──────────────────┬──────────────────┐     │
│      │                  │                  │                  │     │
│      ▼                  ▼                  ▼                  ▼     │
│   [PostgreSQL]      [Firebase]        [Resend]          [Axiom]    │
│   Supabase          FCM Push          Email             Audit      │
│   (Dati personali)  (Token)           (Email)           (Log)      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.6 Periodo di Conservazione

| Categoria Dati | Periodo | Giustificazione |
|----------------|---------|-----------------|
| Dati account | Fino a cancellazione account | Necessità contrattuale |
| Dati di voto | 5 anni in forma anonima | Integrità storica |
| Comunicazioni | 3 anni dall'ultima interazione | Trasparenza e accountability |
| Log di audit e sicurezza | 7 anni dalla creazione | Sicurezza, conformità normativa (allineato a Privacy Policy) |
| Log tecnici (es. Axiom) | 12 mesi (o come da policy fornitore) | Sicurezza e debugging |
| Consensi | 10 anni dalla revoca | Obbligo probatorio GDPR |

### 2.7 Accesso del personale autorizzato (amministratori) a opinioni e voti

Il personale autorizzato (amministratori) può accedere — e, ove previsto sotto, modificare — le **opinioni** e i **voti** degli utenti solo per le finalità e nei limiti di seguito indicati, nel rispetto del principio di minimizzazione (Art. 5(1)(c) GDPR).

| Categoria interessati | Finalità dell'accesso | Visualizzazione | Modifica | Base giuridica |
|-----------------------|------------------------|-----------------|----------|----------------|
| **P, C, CP** (politici, candidati, candidati-politici) | Gestione profili istituzionali; matching efficace; dati da fonte esterna | Sì | Sì | Esecuzione contratto / legittimo interesse; gestione account creati dagli admin |
| **E e altre** (elettori, altri utenti) | Supporto, moderazione, sicurezza/frodi, esercizio diritti GDPR, obblighi di legge | Solo quando necessario | Solo quando necessario (es. rettifica su richiesta, moderazione) | Esecuzione contratto; legittimo interesse; obbligo legale |

**Note operative:**
- Per **P, C, CP**: gli account possono essere creati dagli amministratori; le opinioni/voti possono avere **fonte esterna**. Quando il politico/candidato contatta la piattaforma, l’account può essere attribuito a lui (cambio email, password temporanea).
- Per **E e altre**: nessun accesso generico; solo per supporto, moderazione, sicurezza, diritti dell’interessato, obblighi legali.
- L’accesso è limitato ai ruoli che ne hanno bisogno ed è tracciato (audit log) ove possibile. La presente descrizione è riflessa nell’**informativa privacy** (trasparenza) e nel **registro delle attività di trattamento** (Art. 30 GDPR).

---

## 3. Necessità della DPIA

### 3.1 Criteri di Obbligatorietà (Art. 35 GDPR)

La DPIA è **obbligatoria** quando il trattamento può comportare un **rischio elevato** per i diritti e le libertà delle persone fisiche. 

Il trattamento effettuato da DemosApp soddisfa i seguenti criteri:

| Criterio WP29 | Applicabilità | Dettaglio |
|---------------|---------------|-----------|
| ✅ Dati sensibili su larga scala | **SÌ** | Opinioni politiche (Art. 9 GDPR) |
| ✅ Valutazione/scoring | **SÌ** | Profilazione politica degli utenti |
| ✅ Processo decisionale automatizzato | **PARZIALE** | Assegnazione circoscrizioni |
| ✅ Monitoraggio sistematico | **SÌ** | Tracciamento voti e opinioni |
| ⚠️ Combinazione di dataset | **SÌ** | Dati anagrafici + opinioni + voti |
| ⚠️ Soggetti vulnerabili | **POSSIBILE** | Minoranze politiche |
| ✅ Uso innovativo di tecnologie | **SÌ** | CIE authentication, democrazia digitale |

### 3.2 Conclusione sulla Necessità

**La DPIA è OBBLIGATORIA** per DemosApp in quanto il trattamento:

1. Riguarda dati sensibili (opinioni politiche) ai sensi dell'Art. 9 GDPR
2. È effettuato su larga scala
3. Comporta una profilazione sistematica degli orientamenti politici degli utenti
4. Utilizza tecnologie innovative (autenticazione CIE, democrazia digitale)

---

## 4. Valutazione della Necessità e Proporzionalità

### 4.1 Necessità del Trattamento

| Domanda | Valutazione |
|---------|-------------|
| Il trattamento è necessario per raggiungere la finalità? | **SÌ** - La piattaforma non può funzionare senza raccogliere opinioni e voti |
| Esistono alternative meno invasive? | **NO** - Il servizio richiede intrinsecamente la raccolta di opinioni politiche |
| I dati raccolti sono pertinenti e limitati? | **SÌ** - I dati raccolti sono strettamente necessari alle funzionalità |

### 4.2 Proporzionalità del Trattamento

| Principio | Valutazione | Note |
|-----------|-------------|------|
| **Minimizzazione** | ✅ Rispettato | Solo dati necessari, compressione implementata |
| **Limitazione finalità** | ✅ Rispettato | Finalità chiaramente definite |
| **Esattezza** | ✅ Rispettato | Possibilità di aggiornamento dati |
| **Limitazione conservazione** | ✅ Rispettato | Policy di retention definita |
| **Integrità e riservatezza** | ⚠️ Parziale | Necessaria cifratura a riposo |

### 4.3 Base Giuridica

| Trattamento | Base Giuridica | Riferimento |
|-------------|----------------|-------------|
| Dati identificativi | Esecuzione contratto | Art. 6(1)(b) |
| Dati di residenza | Esecuzione contratto | Art. 6(1)(b) |
| **Opinioni politiche** | **Consenso esplicito** | **Art. 9(2)(a)** |
| **Voti espressi** | **Consenso esplicito** | **Art. 9(2)(a)** |
| Log di sicurezza | Legittimo interesse | Art. 6(1)(f) |
| Notifiche push | Consenso | Art. 6(1)(a) |

### 4.4 Garanzie per gli Interessati

| Diritto GDPR | Implementazione | Endpoint |
|--------------|-----------------|----------|
| Art. 15 - Accesso | ✅ Implementato | `/api/user/rights-requests` |
| Art. 16 - Rettifica | ✅ Implementato | `/api/users/me` PUT |
| Art. 17 - Cancellazione | ✅ Implementato | `/api/user/account` DELETE |
| Art. 18 - Limitazione | ✅ Implementato | `/api/user/limit-processing` |
| Art. 20 - Portabilità | ✅ Implementato | `/api/user/data-export` (JSON/CSV) |
| Art. 21 - Opposizione | ✅ Implementato | `/api/user/object` |

---

## 5. Identificazione e Valutazione dei Rischi

### 5.1 Metodologia di Valutazione

**Probabilità:**
- Trascurabile (1): Evento altamente improbabile
- Bassa (2): Evento poco probabile
- Media (3): Evento possibile
- Alta (4): Evento probabile

**Gravità:**
- Trascurabile (1): Impatto minimo sui diritti
- Bassa (2): Disagio minore reversibile
- Media (3): Disagio significativo ma reversibile
- Alta (4): Conseguenze significative irreversibili

**Rischio = Probabilità × Gravità**
- 1-4: Basso (verde)
- 5-8: Medio (giallo)
- 9-12: Alto (arancione)
- 13-16: Critico (rosso)

### 5.2 Registro dei Rischi

#### R1 - Violazione dati (Data Breach)

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Accesso non autorizzato ai dati personali e opinioni politiche |
| **Conseguenze** | Esposizione opinioni politiche, discriminazione, danni reputazionali |
| **Probabilità** | 2 (Bassa) - Misure di sicurezza in atto |
| **Gravità** | 4 (Alta) - Dati sensibili esposti |
| **Rischio Iniziale** | **8 (Medio)** |

#### R2 - Profilazione politica illecita

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Utilizzo dei dati per profilazione politica non autorizzata |
| **Conseguenze** | Manipolazione, targeting politico, discriminazione |
| **Probabilità** | 2 (Bassa) - Controlli di accesso implementati |
| **Gravità** | 4 (Alta) - Impatto sui diritti democratici |
| **Rischio Iniziale** | **8 (Medio)** |

#### R3 - Compromissione identità tramite CIE

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Attacco al sistema di autenticazione CIE |
| **Conseguenze** | Furto identità, voti fraudolenti |
| **Probabilità** | 1 (Trascurabile) - Sistema governativo |
| **Gravità** | 4 (Alta) - Compromissione identità |
| **Rischio Iniziale** | **4 (Basso)** |

#### R4 - Accesso non autorizzato interno

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Abuso privilegi da parte di amministratori |
| **Conseguenze** | Esposizione dati, manipolazione voti |
| **Probabilità** | 2 (Bassa) - Audit log implementati |
| **Gravità** | 4 (Alta) - Abuso di posizione |
| **Rischio Iniziale** | **8 (Medio)** |

#### R5 - Perdita di disponibilità

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Interruzione del servizio (DDoS, guasti) |
| **Conseguenze** | Impossibilità di votare, perdita fiducia |
| **Probabilità** | 2 (Bassa) - Hosting cloud resiliente |
| **Gravità** | 2 (Bassa) - Impatto temporaneo |
| **Rischio Iniziale** | **4 (Basso)** |

#### R6 - Correlazione dati de-anonimizzati

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Re-identificazione di dati aggregati/anonimi |
| **Conseguenze** | Rivelazione preferenze politiche individuali |
| **Probabilità** | 2 (Bassa) - Dati aggregati su larga scala |
| **Gravità** | 4 (Alta) - Opinioni politiche rivelate |
| **Rischio Iniziale** | **8 (Medio)** |

#### R7 - Trasferimento dati extra-UE

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Servizi cloud potrebbero trasferire dati fuori UE |
| **Conseguenze** | Violazione GDPR, sanzioni |
| **Probabilità** | 2 (Bassa) - Vedi mitigazioni e stato attuale sotto |
| **Gravità** | 3 (Media) - Sanzioni regolatorie |
| **Rischio Iniziale** | **9 (Alto)** → **6 (Medio)** *post-verifica* |

**Stato attuale (da verificare in configurazione):**
- **Supabase (Database):** ✅ **UE** — **Central EU (Frankfurt), `eu-central-1`** (confermato in Dashboard). I dati personali e sensibili risiedono in Germania/UE.
- **Render (Backend):** Regione **Frankfurt (EU)** disponibile — verificare in Render Dashboard che il servizio sia deployato in EU.
- **Axiom (Log):** ✅ **EU** — nel codice è impostato `AXIOM_REGION || 'eu'`.
- **Firebase (FCM):** Trasferimento possibile verso USA — solo token FCM e payload messaggi (nessun dato sensibile dal DB). Con DPA/SCC Google è conforme.
- **Render (Frontend):** Sito statico (demos-frontend); stesso fornitore del backend. Verificare che anche il servizio frontend sia in regione **Frankfurt (EU)**.
- **Resend (Email):** USA — dati (email destinatario, contenuto) trasferiti; richiede DPA/SCC.

#### R8 - Manipolazione delle votazioni

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Attacchi per alterare i risultati delle votazioni |
| **Conseguenze** | Compromissione integrità democratica |
| **Probabilità** | 2 (Bassa) - Controlli implementati |
| **Gravità** | 4 (Alta) - Integrità democratica |
| **Rischio Iniziale** | **8 (Medio)** |

#### R9 - Violazione consenso opinioni politiche

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Trattamento opinioni senza consenso valido Art. 9 |
| **Conseguenze** | Violazione GDPR Art. 9, sanzioni |
| **Probabilità** | 1 (Trascurabile) - Consenso esplicito implementato |
| **Gravità** | 4 (Alta) - Trattamento illecito dati sensibili |
| **Rischio Iniziale** | **4 (Basso)** |

#### R10 - Mancata cifratura dati a riposo

| Parametro | Valore |
|-----------|--------|
| **Descrizione** | Dati sensibili non cifrati nel database |
| **Conseguenze** | Esposizione in caso di breach |
| **Probabilità** | 3 (Media) - Attualmente non implementata |
| **Gravità** | 4 (Alta) - Dati sensibili esposti |
| **Rischio Iniziale** | **12 (Alto)** |

### 5.3 Matrice dei Rischi

```
                    GRAVITÀ
           │  1    │  2    │  3    │  4
    ───────┼───────┼───────┼───────┼───────
      4    │       │       │       │ R10
Prob. 3    │       │       │ R7    │
      2    │       │ R5    │       │ R1,R2,R4,R6,R8
      1    │       │       │       │ R3,R9
```

### 5.4 Riepilogo Rischi per Livello

| Livello | Rischi | Azione Richiesta |
|---------|--------|------------------|
| 🔴 **Critico** (13-16) | - | - |
| 🟠 **Alto** (9-12) | R7, R10 | Mitigazione urgente |
| 🟡 **Medio** (5-8) | R1, R2, R4, R6, R8 | Mitigazione pianificata |
| 🟢 **Basso** (1-4) | R3, R5, R9 | Monitoraggio |

---

## 6. Misure di Mitigazione

### 6.1 Misure Già Implementate

| ID | Misura | Rischi Mitigati | Stato |
|----|--------|-----------------|-------|
| M1 | Password hashing con bcrypt (10 rounds) | R1, R4 | ✅ Attivo |
| M2 | JWT token authentication | R1, R4, R8 | ✅ Attivo |
| M3 | Rate limiting su tutti gli endpoint | R1, R5, R8 | ✅ Attivo |
| M4 | Audit logging GDPR-compliant | R2, R4, R8 | ✅ Attivo |
| M5 | HTTPS/TLS in transito | R1 | ✅ Attivo |
| M6 | Consenso esplicito per Art. 9 | R9 | ✅ Attivo |
| M7 | Diritti GDPR implementati | R2, R9 | ✅ Attivo |
| M8 | IP address troncato nei log | R2 | ✅ Attivo |
| M9 | Validazione e sanitizzazione input | R1, R8 | ✅ Attivo |
| M10 | RBAC (Role-Based Access Control) | R4 | ✅ Attivo |
| M11 | Data retention policy | R2, R6 | ✅ Attivo |

### 6.2 Misure Aggiuntive Raccomandate

#### M12 - Cifratura a Riposo (Priorità: ALTA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R1, R10 |
| **Descrizione** | Implementare cifratura AES-256 per i dati sensibili nel database |
| **Campi da cifrare** | Opinioni politiche, voti, codice fiscale |
| **Timeline** | Immediata |
| **Responsabile** | [Da assegnare] |

#### M13 - Valutazione Trasferimenti Extra-UE (Priorità: ALTA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R7 |
| **Descrizione** | Audit completo dei sub-responsabili e data residency |
| **Azioni** | 1. ✅ **Supabase:** **Frankfurt (`eu-central-1`)** — confermato in Dashboard |
|           | 2. **Render (backend + frontend):** verificare in Dashboard che entrambi i servizi (demos-backend e demos-frontend) siano in regione **Frankfurt (EU)** |
|           | 3. **Axiom:** confermare `AXIOM_REGION=eu` in produzione |
|           | 4. **Firebase/Resend:** stipulare o accettare DPA con SCC (Supabase e Google li offrono) |
|           | 5. Documentare in Allegato F i DPA firmati e la data residency per ogni fornitore |
| **Timeline** | 30 giorni |
| **Responsabile** | [Da assegnare] |

#### M14 - Segregazione Database Dati Sensibili (Priorità: MEDIA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R1, R2, R6 |
| **Descrizione** | Separare fisicamente i dati sensibili (opinioni/voti) dal database principale |
| **Timeline** | 60 giorni |
| **Responsabile** | [Da assegnare] |

#### M15 - Penetration Testing (Priorità: MEDIA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R1, R3, R8 |
| **Descrizione** | Test di sicurezza periodici da terze parti certificate |
| **Frequenza** | Annuale + dopo major release |
| **Timeline** | Prima del lancio pubblico |
| **Responsabile** | [Da assegnare] |

#### M16 - Backup Cifrato e Disaster Recovery (Priorità: MEDIA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R5 |
| **Descrizione** | Backup automatici cifrati con piano DR testato |
| **RTO** | 4 ore |
| **RPO** | 1 ora |
| **Timeline** | 45 giorni |
| **Responsabile** | [Da assegnare] |

#### M17 - Multi-Factor Authentication (Priorità: MEDIA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R1, R4 |
| **Descrizione** | MFA obbligatorio per admin, opzionale per utenti |
| **Timeline** | 60 giorni |
| **Responsabile** | [Da assegnare] |

#### M18 - Differential Privacy per Statistiche (Priorità: BASSA)

| Parametro | Dettaglio |
|-----------|-----------|
| **Rischi Mitigati** | R6 |
| **Descrizione** | Implementare noise statistico per prevenire de-anonimizzazione |
| **Timeline** | 90 giorni |
| **Responsabile** | [Da assegnare] |

### 6.3 Rischi Residui Post-Mitigazione

| Rischio | Iniziale | Mitigazioni | Residuo | Accettabile |
|---------|----------|-------------|---------|-------------|
| R1 - Data Breach | 8 | M1,M2,M3,M5,M9,M12,M15 | **4** | ✅ Sì |
| R2 - Profilazione illecita | 8 | M4,M7,M8,M10,M11,M14 | **3** | ✅ Sì |
| R3 - Compromissione CIE | 4 | M15 | **2** | ✅ Sì |
| R4 - Accesso interno | 8 | M4,M10,M17 | **4** | ✅ Sì |
| R5 - Disponibilità | 4 | M16 | **2** | ✅ Sì |
| R6 - De-anonimizzazione | 8 | M11,M14,M18 | **4** | ✅ Sì |
| R7 - Trasferimento extra-UE | 9 → 6* | M13 + Supabase EU + Render EU + Axiom EU | **3** | ✅ Sì | *Ridotto se DB e backend in EU; Firebase/Resend con SCC |
| R8 - Manipolazione voti | 8 | M3,M4,M9,M15 | **4** | ✅ Sì |
| R9 - Violazione consenso | 4 | M6,M7 | **2** | ✅ Sì |
| R10 - No cifratura riposo | 12 | M12 | **4** | ✅ Sì |

---

## 7. Parere del DPO

*Sezione da compilare a cura del Data Protection Officer*

### 7.1 Valutazione DPO

| Aspetto | Valutazione |
|---------|-------------|
| Completezza della DPIA | ☐ Adeguata / ☐ Da integrare |
| Identificazione rischi | ☐ Adeguata / ☐ Da integrare |
| Misure di mitigazione | ☐ Adeguate / ☐ Da integrare |
| Rischi residui | ☐ Accettabili / ☐ Non accettabili |

### 7.2 Osservazioni

```
[Spazio per osservazioni del DPO]
```

### 7.3 Raccomandazioni Vincolanti

```
[Spazio per raccomandazioni]
```

### 7.4 Esito

| Esito | Data | Firma DPO |
|-------|------|-----------|
| ☐ Parere favorevole | | |
| ☐ Parere favorevole con prescrizioni | | |
| ☐ Parere negativo | | |

---

## 8. Piano di Attuazione

### 8.1 Cronoprogramma Misure

| Misura | Priorità | Deadline | Responsabile | Status |
|--------|----------|----------|--------------|--------|
| M12 - Cifratura a riposo | 🔴 Alta | [+30gg] | [TBD] | ☐ Pianificato |
| M13 - Audit trasferimenti UE | 🔴 Alta | [+30gg] | [TBD] | ☐ Pianificato |
| M14 - Segregazione DB | 🟠 Media | [+60gg] | [TBD] | ☐ Pianificato |
| M15 - Pen Test | 🟠 Media | [Pre-lancio] | [TBD] | ☐ Pianificato |
| M16 - Backup/DR | 🟠 Media | [+45gg] | [TBD] | ☐ Pianificato |
| M17 - MFA | 🟠 Media | [+60gg] | [TBD] | ☐ Pianificato |
| M18 - Differential Privacy | 🟢 Bassa | [+90gg] | [TBD] | ☐ Pianificato |

### 8.2 Indicatori di Monitoraggio (KPI)

| KPI | Target | Frequenza Verifica |
|-----|--------|-------------------|
| Tentativi di accesso bloccati | < 1% utenti legittimi | Mensile |
| Tempo risposta richieste GDPR | < 30 giorni | Per richiesta |
| Incidenti di sicurezza | 0 critici | Mensile |
| Uptime servizio | > 99.5% | Mensile |
| Completezza audit log | 100% | Trimestrale |

### 8.3 Revisione DPIA

| Evento | Azione |
|--------|--------|
| Ogni 12 mesi | Revisione ordinaria |
| Nuove funzionalità | Valutazione impatto aggiuntiva |
| Data breach | Revisione straordinaria immediata |
| Cambio normativo | Revisione straordinaria |
| Cambio significativo infrastruttura | Valutazione impatto aggiuntiva |

---

## 9. Conclusioni e Approvazione

### 9.1 Sintesi della Valutazione

La presente DPIA ha analizzato il trattamento dei dati personali effettuato dalla piattaforma DemosApp, identificando:

- **10 rischi** significativi per i diritti degli interessati
- **2 rischi ad alta priorità** (trasferimenti extra-UE, mancata cifratura a riposo)
- **11 misure già implementate** per la protezione dei dati
- **7 misure aggiuntive raccomandate** per ridurre i rischi residui

### 9.2 Decisione Finale

Sulla base dell'analisi effettuata:

| Opzione | Selezione |
|---------|-----------|
| ☐ Il trattamento può procedere senza modifiche | |
| ☐ Il trattamento può procedere con le misure aggiuntive indicate | |
| ☐ È necessaria consultazione preventiva con il Garante (Art. 36 GDPR) | |
| ☐ Il trattamento non può procedere | |

### 9.3 Firme di Approvazione

| Ruolo | Nome | Data | Firma |
|-------|------|------|-------|
| Titolare del Trattamento | | | |
| DPO | | | |
| Responsabile IT | | | |
| Responsabile Sicurezza | | | |

---

## 10. Allegati

### Allegato A - Inventario Dati Personali

#### A.1 Dati Identificativi

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `email` | Indirizzo email dell'utente | Sì | Identificazione, login, comunicazioni | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `password_hash` | Hash bcrypt della password | Sì | Autenticazione sicura | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `nome` | Nome dell'utente | Sì | Identificazione | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `cognome` | Cognome dell'utente | Sì | Identificazione | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `fiscal_number` | Codice fiscale (solo login CIE) | No | Autenticazione CIE | Art. 6(1)(b) Contratto | Fino a cancellazione account |

#### A.2 Dati Anagrafici

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `data_nascita` | Data di nascita | Sì | Verifica maggiore età, statistiche | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `genere` | Genere (U/D/A: Uomo, Donna, Altro) | Sì | Statistiche demografiche | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `cittadinanza` | Italiana/Straniera/San Marino/Svizzera (it/st/sm/ch). Il wizard principale offre Italiana, San Marino, Svizzera; valori "st" (straniera) gestiti da backend e profilo. | Sì | Determinazione diritti elettorali | Art. 6(1)(b) Contratto | Fino a cancellazione account |

#### A.3 Dati di Residenza

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `paese_residenza` | Paese di residenza | Sì | Circoscrizione elettorale | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `regione_residenza` | Regione di residenza | Sì | Circoscrizione elettorale | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `provincia_residenza` | Provincia di residenza | Sì* | Circoscrizione elettorale | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `comune_residenza` | Comune di residenza | Sì* | Circoscrizione elettorale | Art. 6(1)(b) Contratto | Fino a cancellazione account |

*\* Obbligatori nel wizard di registrazione solo per residenti in Italia, San Marino o Svizzera (con regione diversa da "Estero"); per altri paesi possono essere opzionali.*

#### A.4 Dati Elettorali

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `grado_elezione` | Livello territoriale di voto | No | Competenze di voto | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `paese_elezione` | Paese per il voto | No | Assegnazione votazioni | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `regione_elezione` | Regione per il voto | No | Assegnazione votazioni | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `provincia_elezione` | Provincia per il voto | No | Assegnazione votazioni | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `comune_elezione` | Comune per il voto | No | Assegnazione votazioni | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `grado_candidatura` | Livello candidatura | No | Gestione candidature | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `rappresentante_europeo` | ID rappresentante UE scelto | No | Funzionalità piattaforma | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `rappresentante_camera` | ID rappresentante Camera | No | Funzionalità piattaforma | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `rappresentante_senato` | ID rappresentante Senato | No | Funzionalità piattaforma | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `rappresentante_regionale` | ID rappresentante regionale | No | Funzionalità piattaforma | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `rappresentante_comune` | ID rappresentante comunale | No | Funzionalità piattaforma | Art. 6(1)(b) Contratto | Fino a cancellazione account |

#### A.5 ⚠️ DATI SENSIBILI - Opinioni Politiche (Art. 9 GDPR)

I campi relativi alle opinioni politiche sono **configurabili** (la piattaforma può aggiungere o rimuovere temi). In tabella si descrive la **categoria**; l'elenco aggiornato dei campi (es. `opinione_energia_nucleare`, `opinione_sperimentazione_animale`, ecc.) è nella documentazione tecnica e nell'informativa privacy.

| Categoria / Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------------------|-------------|--------------|----------|----------------|---------------|
| Campi `opinione_*` (temi definiti dalla piattaforma) | Per ogni tema: Favorevole / Contrario / Astenuto. Elenco temi aggiornabile senza modifica della DPIA. | No | Aggregazione statistica, confronto con rappresentanti | **Art. 9(2)(a) Consenso esplicito** | Fino a cancellazione account |

#### A.6 ⚠️ DATI SENSIBILI - Voti Espressi (Art. 9 GDPR)

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `voto_capo_stato` | ID candidato votato | No | Votazione Capo di Stato | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |
| `voto_referendum_*` | Voto su referendum | No | Partecipazione referendum | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |
| `voto_iniziativa_*` | Voto su iniziativa popolare | No | Partecipazione iniziative | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |
| `voto_ice_*` | Voto su ICE/ECI | No | Partecipazione ICE | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |
| `voto_amnistia` | Voto su amnistia | No | Partecipazione votazione | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |
| `voto_grazia` | Voto su grazia | No | Partecipazione votazione | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |
| `voto_ministri` | Voti su ministri | No | Partecipazione votazione | **Art. 9(2)(a) Consenso esplicito** | 5 anni (anonimizzato) |

#### A.7 Dati di Profilo Pubblico (Opzionali)

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `avatar_config` | Configurazione avatar | No | Personalizzazione | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `facebook_url` | Link profilo Facebook | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `twitter_url` | Link profilo Twitter/X | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `instagram_url` | Link profilo Instagram | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `linkedin_url` | Link profilo LinkedIn | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `telegram_url` | Link Telegram | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `youtube_url` | Link canale YouTube | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `twitch_url` | Link canale Twitch | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |
| `website_url` | Sito web personale | No | Profilo pubblico | Art. 6(1)(a) Consenso | Fino a cancellazione account |

#### A.8 Dati Tecnici e di Sicurezza

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `fcm_tokens` | Token Firebase Cloud Messaging (array, un token per dispositivo) | No | Notifiche push | Art. 6(1)(a) Consenso | Fino a revoca consenso |
| `status` / `email_verified_at` / `email_verification_token` | Verifica email (stato account e token) | Auto | Sicurezza account | Art. 6(1)(b) Contratto | Fino a cancellazione account |
| `created_at` | Data creazione account | Auto | Audit, statistiche | Art. 6(1)(f) Legittimo interesse | Fino a cancellazione account |
| `updated_at` | Data ultimo aggiornamento | Auto | Audit | Art. 6(1)(f) Legittimo interesse | Fino a cancellazione account |
| `last_login` | Data ultimo accesso | Auto | Sicurezza, statistiche | Art. 6(1)(f) Legittimo interesse | Fino a cancellazione account |
| `ruolo` | Ruolo utente (E/P/C/CP/A/I/O/AD: Elettore, Politico, Candidato, Candidato Politico, Attivista, Istituzione, Organizzazione, Admin) | Auto | Autorizzazione | Art. 6(1)(b) Contratto | Fino a cancellazione account |

#### A.9 Dati di Consenso (GDPR Accountability)

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `privacy_policy_consent` | Consenso privacy policy | Sì | Prova consenso | Art. 6(1)(c) Obbligo legale | 10 anni dalla revoca |
| `terms_of_service_consent` | Consenso ToS | Sì | Prova consenso | Art. 6(1)(c) Obbligo legale | 10 anni dalla revoca |
| `political_opinions_consent` | Consenso Art. 9 opinioni | Sì* | Prova consenso esplicito | Art. 6(1)(c) Obbligo legale | 10 anni dalla revoca |
| `consent_timestamp` | Data/ora consenso | Auto | Prova consenso | Art. 6(1)(c) Obbligo legale | 10 anni dalla revoca |
| `political_opinions_consent_ip_address` | IP al momento del consenso | Auto | Prova consenso | Art. 6(1)(f) Legittimo interesse | 10 anni dalla revoca |
| `political_opinions_consent_user_agent` | User agent al momento del consenso | Auto | Prova consenso | Art. 6(1)(f) Legittimo interesse | 10 anni dalla revoca |

*\* Obbligatorio per utilizzare funzionalità opinioni/voto*

#### A.10 Dati di Audit Log

I campi sotto si riferiscono ai log inviati ad Axiom e/o a sistemi di audit. La conservazione per log di audit e sicurezza è **fino a 7 anni** (conformità; cfr. sez. 2.6 e Privacy Policy); la retention operativa in Axiom può essere configurata (es. 12 mesi).

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `_time` | Timestamp evento | Auto | Audit GDPR | Art. 6(1)(c) Obbligo legale | Fino a 7 anni |
| `user_id` | ID utente (anonimizzabile) | Auto | Audit GDPR | Art. 6(1)(c) Obbligo legale | Fino a 7 anni |
| `ip_address` | IP troncato (x.x.x.0) | Auto | Sicurezza | Art. 6(1)(f) Legittimo interesse | Fino a 7 anni |
| `action` | Tipo azione eseguita | Auto | Audit GDPR | Art. 6(1)(c) Obbligo legale | Fino a 7 anni |
| `resource` | Risorsa coinvolta | Auto | Audit GDPR | Art. 6(1)(c) Obbligo legale | Fino a 7 anni |
| `success` | Esito operazione | Auto | Sicurezza | Art. 6(1)(f) Legittimo interesse | Fino a 7 anni |
| `session_id` | ID sessione | Auto | Sicurezza | Art. 6(1)(f) Legittimo interesse | Fino a 7 anni |

#### A.11 Dati Temporanei (CIE Authentication)

| Campo DB | Descrizione | Obbligatorio | Finalità | Base Giuridica | Conservazione |
|----------|-------------|--------------|----------|----------------|---------------|
| `cie_pending_registrations.*` | Dati temporanei flusso CIE | Auto | Completamento registrazione CIE | Art. 6(1)(b) Contratto | 24 ore (auto-eliminazione) |

---

#### A.12 Riepilogo per Categoria GDPR

| Categoria | N. Campi | Art. GDPR | Richiede Consenso Esplicito |
|-----------|----------|-----------|----------------------------|
| Dati identificativi | 5 | Art. 6 | No |
| Dati anagrafici | 3 | Art. 6 | No (Genere: Sì) |
| Dati di residenza | 4 | Art. 6 | No |
| Dati elettorali | 11 | Art. 6 | No |
| **Opinioni politiche** | **Variabile (temi configurabili)** | **Art. 9** | **SÌ** |
| **Voti espressi** | **~10** | **Art. 9** | **SÌ** |
| Dati profilo pubblico | 9 | Art. 6 | No |
| Dati tecnici | 6 | Art. 6 | No (FCM: Sì) |
| Dati consenso | 6 | Art. 6 | No |
| Dati audit | 7 | Art. 6 | No |

### Allegato B - Registro dei Trattamenti

*[Da compilare con riferimento al Registro ex Art. 30 GDPR]*

### Allegato C - Informativa Privacy

**Link (produzione):** https://www.demos.community/privacy-policy

L’informativa privacy (Privacy Policy) include una sezione dedicata (**6.1 Accesso del personale autorizzato (amministratori) a opinioni e voti**) che spiega in modo trasparente perché gli amministratori possono vedere (e, per le categorie P/C/CP, modificare) le opinioni e i voti degli utenti, con distinzione tra politici/candidati (P, C, CP) ed elettori/altri (E), nel rispetto del principio di minimizzazione e delle basi giuridiche applicabili.

### Allegato D - Modulo Consenso Art. 9

*[Esempio di consenso raccolto per opinioni politiche]*

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONSENSO OPINIONI POLITICHE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Ai sensi dell'Art. 9 del GDPR, acconsento espressamente al        │
│  trattamento delle mie opinioni politiche da parte di DemosApp     │
│  per le finalità di aggregazione statistica e partecipazione       │
│  democratica.                                                       │
│                                                                     │
│  Comprendo che:                                                     │
│  • Posso revocare il consenso in qualsiasi momento                 │
│  • I miei dati saranno trattati con misure di sicurezza adeguate   │
│  • Ho diritto di accesso, rettifica e cancellazione                │
│                                                                     │
│  ☐ Acconsento al trattamento delle mie opinioni politiche          │
│                                                                     │
│  Data: ________________    IP: ________________                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Allegato E - Schema Architettura Sicurezza

*[Diagramma tecnico dell'architettura di sicurezza]*

### Allegato F - Contratti con Responsabili del Trattamento e Data Residency

| Fornitore | Servizio | Dati trattati | Data Residency | DPA/SCC | Note |
|-----------|----------|---------------|----------------|---------|------|
| **Supabase** | Database PostgreSQL | Tutti i dati personali e sensibili | ✅ **UE — Central EU (Frankfurt), `eu-central-1`** | ✅ **Sì** | DPA: https://supabase.com/legal/dpa (SCC 2021). Privacy: https://supabase.com/privacy. Limite connessioni piano: 60 (monitorato in `/admin/parametri`) |
| **Render** | Backend API + Frontend (statico) | Backend: elaborazione; Frontend: solo asset statici, nessun dato persistito | ✅ **demos-backend: Frankfurt (EU Central)**. Frontend: Static Site (nessun campo Region in Settings; solo asset, dati elaborati dal backend in UE) | ✅ **Sì** | DPA: https://render.com/dpa (incorporato nei ToS). EU-US DPF certificato (gen 2025). **Backend verificato in UE.** |
| **Firebase** | Push (FCM) | Token FCM, payload notifiche | Extra-UE (Google); trasferimento coperto da SCC | ✅ **Sì** | Data Processing and Security Terms + SCC (Controller-to-Processor / Processor): https://firebase.google.com/terms/data-processing-terms e https://firebase.google.com/terms/firebase-sccs. Accettati con l’uso di Firebase. Solo token e payload messaggi (nessun dato sensibile dall’app). |
| **Resend** | Email transazionali | Email destinatario, contenuto | Dominio demos.community: **Ireland (eu-west-1)** per invio; dati account/metadata in US (SCC) | ✅ **Sì** | DPA con SCC: https://resend.com/legal/dpa (incorporato nei ToS). **Invio email già da regione EU (Ireland)** per il dominio in uso. |
| **Axiom** | Logging / audit | Log (IP troncato, eventi) | ✅ **EU** | ✅ **Sì** | DPA incorporato nei ToS (accettato con l’uso del servizio). SCC 2021 (Modulo Two) in Schedule 3 del DPA. Regione: `AXIOM_REGION=eu` (Render). Riferimento: https://axiom.co/docs/legal/data-processing |

**Checklist per ridurre R7 (trasferimenti extra-UE):**
1. ✅ **Supabase:** **Frankfurt (`eu-central-1`)**. DPA: https://supabase.com/legal/dpa
2. ✅ **Render:** **demos-backend** in **Frankfurt (EU Central)**. **demos-frontend** = Static Site (nessuna opzione Region in Settings; solo asset statici; il trattamento dati avviene sul backend in UE). DPA/DPF: https://render.com/dpa
3. ✅ **Axiom:** verificato in produzione — `AXIOM_REGION=eu` (Render, demos-backend). DPA (con SCC) accettato con l’uso del servizio; riferimento: https://axiom.co/docs/legal/data-processing
4. ✅ **Resend:** DPA con SCC: https://resend.com/legal/dpa. ✅ **Firebase:** Data Processing and Security Terms + SCC: https://firebase.google.com/terms/data-processing-terms e https://firebase.google.com/terms/firebase-sccs (accettati con l’uso di Firebase). ✅ **Supabase:** DPA: https://supabase.com/legal/dpa. Conservare copia dei DPA per accountability.
5. ☐ Aggiornare l’informativa privacy con l’elenco dei sub-responsabili e le garanzie (SCC / DPF o equivalenti).

---

### Allegato G - Contratto di Nomina DPO (Contenuti Minimi)

Il contratto/lettera di incarico tra Democracy Institute APS e il DPO deve contenere almeno:

**1. PARTI CONTRAENTI**
- Titolare del Trattamento: Democracy Institute APS, C.F. [...], in persona del Legale Rappresentante
- DPO: [Nome/Ragione Sociale], [qualifiche professionali], [contatti]

**2. OGGETTO DELL'INCARICO**
Nomina a Data Protection Officer ai sensi degli Artt. 37-39 del Regolamento UE 2016/679 (GDPR).

**3. COMPITI DEL DPO (Art. 39 GDPR)**
- Informare e fornire consulenza al Titolare sugli obblighi GDPR
- Sorvegliare l'osservanza del GDPR e delle policy privacy
- Fornire pareri sulla DPIA e sorvegliarne lo svolgimento
- Cooperare con l'Autorità Garante
- Fungere da punto di contatto per l'Autorità Garante
- Fungere da punto di contatto per gli interessati

**4. GARANZIE DI INDIPENDENZA (Art. 38 GDPR)**
- Il DPO non riceve istruzioni per quanto riguarda l'esecuzione dei compiti
- Il DPO non può essere rimosso o penalizzato per l'adempimento dei propri compiti
- Il DPO riferisce direttamente al vertice dell'organizzazione
- Assenza di conflitti di interesse con altre funzioni

**5. RISORSE E MEZZI**
Il Titolare si impegna a fornire:
- Accesso ai dati personali e alle operazioni di trattamento
- Accesso alle altre funzioni aziendali (IT, legale, HR)
- Risorse finanziarie, infrastrutturali e di personale necessarie
- Formazione continua per mantenere la conoscenza specialistica

**6. RISERVATEZZA**
Il DPO è tenuto al segreto e alla riservatezza in merito ai dati e alle informazioni di cui viene a conoscenza.

**7. DURATA E NATURA DELL'INCARICO**
- Durata: [Determinata/Indeterminata] - Decorrenza dal [data]
- **Natura dell'incarico:** Gratuito / Pro bono / Volontariato
- Il DPO svolge l'incarico a titolo gratuito, condividendo le finalità di promozione sociale dell'Associazione
- L'assenza di compenso non pregiudica l'indipendenza e l'autonomia del DPO nell'esercizio delle sue funzioni
- Eventuali rimborsi spese documentate: ☐ Sì / ☐ No

**8. RECESSO E RISOLUZIONE**
- Preavviso minimo: [es. 60 giorni]
- Cause di risoluzione immediata: [specificare]

**9. COMUNICAZIONE AL GARANTE**
Il Titolare si impegna a comunicare i dati di contatto del DPO all'Autorità Garante entro [termine] dalla nomina, ai sensi dell'Art. 37(7) GDPR.

**10. PUBBLICAZIONE**
I dati di contatto del DPO saranno pubblicati:
- Nell'informativa privacy dell'app
- Sul sito web dell'Associazione
- Nella scheda app sugli store

---

**Firma Titolare del Trattamento:**

_________________________________
[Nome], Legale Rappresentante
Democracy Institute APS

Data: ________________


**Firma DPO:**

_________________________________
[Nome DPO]

Data: ________________

---

## Storico Revisioni

| Versione | Data | Autore | Modifiche |
|----------|------|--------|-----------|
| 1.0 | 20/02/2026 | Nicolas Micheletti | Versione iniziale |

---

*Documento generato in conformità alle linee guida WP248 rev.01 dell'EDPB sulla Valutazione d'Impatto sulla Protezione dei Dati*
