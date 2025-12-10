# 📧 Messaggio per Supporto Axiom (Italiano)

## Oggetto
**Errore 403 Forbidden con Token API nonostante Permessi Corretti**

---

## Corpo del Messaggio

Salve Team di Supporto Axiom,

Sto riscontrando un errore persistente **403 Forbidden** quando provo a usare l'API Axiom, nonostante il mio token API sembri avere i permessi corretti configurati.

### Dettagli Organizzazione
- **Organization ID**: `demos-institute-jrim`
- **Regione**: EU (`eu`)
- **Account**: Demos Institute

### Dettagli Token API
- **Nome Token**: `demosapp-backup`
- **ID Token**: `<REDACTED_API_KEY>`
- **Permessi Configurati**:
  - **Ingest**: CREATE ✅, READ ✅
  - **Query**: READ ✅
  - **Scope**: All datasets (tutti i dataset)

### Descrizione del Problema

Tutte le richieste API ad Axiom restituiscono `403 - forbidden`, inclusi:
1. **Lista dataset**: `GET https://api.eu.axiom.co/v1/datasets`
2. **Ingest dati**: `POST https://api.eu.axiom.co/v1/datasets/centralized_logs/ingest`
3. **Test ingest**: `POST https://api.eu.axiom.co/v1/datasets/real-time/ingest`

### Dettagli Richiesta

**Endpoint testato**: `https://api.eu.axiom.co/v1/datasets/centralized_logs/ingest`

**Headers utilizzati**:
```
Authorization: Bearer <REDACTED_API_KEY>
Content-Type: application/json
X-Axiom-Org-Id: demos-institute-jrim
```

**Body richiesta** (esempio):
```json
[
  {
    "_time": "2025-12-10T18:45:00.000Z",
    "level": "INFO",
    "message": "Test evento",
    "log_type": "test"
  }
]
```

**Risposta**:
```json
{
  "code": 403,
  "message": "forbidden"
}
```

### Cosa Ho Verificato

✅ Il token è configurato correttamente nel dashboard Axiom  
✅ Il token ha permessi Ingest (CREATE, READ) e Query (READ)  
✅ Il token è impostato per "All datasets"  
✅ L'Organization ID è corretto: `demos-institute-jrim`  
✅ La regione è correttamente impostata su EU  
✅ I dataset esistono: `centralized_logs` e `real-time`  
✅ Il formato della richiesta corrisponde alla documentazione API Axiom  
✅ Ho provato con e senza header `X-Axiom-Org-Id`  
✅ Ho provato endpoint diversi (entrambi i dataset)  
✅ Il token è stato rigenerato e aggiornato nelle variabili d'ambiente  

### Ambiente

- **Piattaforma**: Render (cloud hosting)
- **Regione**: EU
- **SDK**: `@axiomhq/axiom-node` v0.12.0
- **Metodo API**: Chiamate HTTP dirette (ho anche provato con SDK)

### Domande

1. C'è un ritardo dopo la creazione del token prima che diventi attivo?
2. Ci sono problemi noti con i token API della regione EU?
3. Potrebbe esserci un problema con i permessi "All datasets"?
4. È richiesto un metodo di autenticazione diverso per la regione EU?

### Informazioni Aggiuntive

- Il token è stato creato/rigenerato oggi (10 dicembre 2025)
- Tutte le variabili d'ambiente sono configurate correttamente
- Lo stesso errore si verifica sia localmente che su Render
- Ho verificato che il token corrisponda esattamente a quello mostrato nel dashboard Axiom

Potreste per favore investigare perché l'API restituisce 403 nonostante il token abbia i permessi corretti? Qualsiasi indicazione sarebbe molto apprezzata.

Grazie per l'assistenza.

---

**Informazioni di Contatto** (se necessario):
- Organizzazione: Demos Institute
- Organization ID: `demos-institute-jrim`

---

## 📋 Come Inviare

1. Vai su: https://axiom.co/support
2. Oppure: https://docs.axiom.xyz/api-reference/support-and-config/getting-help
3. Copia e incolla il messaggio sopra (usa la versione inglese se il supporto è in inglese)
4. Allega screenshot se necessario (delle impostazioni del token)

