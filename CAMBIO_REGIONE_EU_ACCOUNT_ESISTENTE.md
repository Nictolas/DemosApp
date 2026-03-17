# 🔄 Come Cambiare Regione in EU - Account Axiom Esistente

## ⚠️ IMPORTANTE

**Axiom generalmente NON permette di cambiare la regione di un'organization esistente.** Tuttavia, ci sono alcune soluzioni.

---

## 📋 Metodo 1: Verifica e Cambio (se disponibile)

### **Passo 1: Accedi al Tuo Account**

1. Vai su **https://app.axiom.co/** (o https://axiom.co/)
2. Fai login con le tue credenziali

### **Passo 2: Vai alle Impostazioni Organization**

1. Clicca sul tuo **avatar/profilo** in alto a destra
2. Nel menu, clicca su **"Settings"** o **"Organization Settings"**

**OPPURE**

1. Nel menu laterale sinistro, cerca **"Settings"** (icona ⚙️)
2. Clicca su **"Settings"**
3. Nel menu laterale delle impostazioni, clicca su **"Organization"**

### **Passo 3: Verifica la Regione Attuale**

1. Nella pagina Organization, cerca:
   - **"Region"**
   - **"Data Region"**
   - **"Organization Region"**
   - **"Location"**

2. **Controlla quale regione è impostata:**
   - Se vedi **"EU"**, **"Europe"**, o **"eu-west-1"** → ✅ **Sei già in EU!**
   - Se vedi **"US"**, **"United States"**, o **"us-east-1"** → Devi cambiarla

### **Passo 4: Prova a Cambiare (se l'opzione esiste)**

1. Se vedi un pulsante **"Change Region"** o **"Edit Region"**:
   - Clicca su di esso
   - Seleziona **"EU"** o **"Europe"**
   - Clicca **"Save"** o **"Update"**

2. **Se NON vedi questa opzione:**
   - La regione è bloccata (comportamento normale di Axiom)
   - Passa al **Metodo 2** o **Metodo 3**

---

## 📋 Metodo 2: Creare Nuova Organization in EU

Se non puoi cambiare la regione, crea una nuova organization in EU:

### **Passo 1: Vai a Organizations**

1. Vai su **"Settings"** → **"Organizations"**
   - **Nota**: Questa opzione potrebbe non essere visibile se hai solo un'organization

### **Passo 2: Crea Nuova Organization**

1. Clicca su **"Create Organization"** o **"New Organization"**
2. Compila il form:
   - **Nome**: `DemosApp EU` (o un nome a tua scelta)
   - **Regione**: Seleziona **"EU"** o **"Europe"**
3. Clicca **"Create"**

### **Passo 3: Passa alla Nuova Organization**

1. Dopo la creazione, passa alla nuova organization:
   - Clicca sul menu in alto (dove c'è il nome dell'organization)
   - Seleziona la nuova organization **"DemosApp EU"**

### **Passo 4: Ricrea Dataset e Token**

1. **Crea il dataset:**
   - Vai su **"Datasets"** → **"Create Dataset"**
   - Nome: `demosapp-logs`

2. **Crea il token:**
   - Vai su **"Settings"** → **"API Tokens"**
   - Crea nuovo token con permessi "Ingest" e "Query"

3. **Aggiorna il `.env`** con:
   - Nuovo Organization ID
   - Nuovo API Token

---

## 📋 Metodo 3: Contattare il Supporto Axiom (CONSIGLIATO)

Il supporto Axiom può aiutarti a cambiare la regione o creare una nuova organization in EU.

### **Passo 1: Prepara le Informazioni**

Prima di contattare il supporto, prepara:
- **Nome della tua organization attuale**
- **Email associata all'account**
- **Motivo**: GDPR compliance / conformità europea

### **Passo 2: Contatta il Supporto**

**Opzione A: Email**
1. Invia email a: **support@axiom.co**
2. Oggetto: `Request to change organization region to EU`
3. Messaggio (copia e incolla):

```
Subject: Request to change organization region to EU

Hi Axiom Support,

I have an existing Axiom account and I need to change my organization region to EU for GDPR compliance.

Organization name: [INSERISCI IL NOME DELLA TUA ORGANIZATION]
Account email: [INSERISCI LA TUA EMAIL]

Could you please help me either:
1. Change my current organization region to EU, or
2. Create a new organization in the EU region and migrate my data?

Thank you for your assistance!

Best regards,
[IL TUO NOME]
```

**Opzione B: Chat Support (se disponibile)**
1. Nella dashboard Axiom, cerca **"Help"**, **"Support"**, o **"Contact"**
2. Apri il chat support
3. Chiedi: "I need to change my organization region to EU for GDPR compliance"

**Opzione C: Intercom (se disponibile)**
1. Cerca il widget di chat in basso a destra nella dashboard
2. Clicca e inizia una conversazione
3. Spiega che hai bisogno di cambiare la regione in EU

### **Passo 3: Attendi Risposta**

Il supporto Axiom di solito risponde entro 24-48 ore. Ti diranno:
- Se possono cambiare la regione dell'organization esistente
- Oppure ti aiuteranno a creare una nuova organization in EU

---

## 📋 Metodo 4: Usare l'API per Verificare la Regione

Puoi verificare la regione attuale usando l'API Axiom:

### **Passo 1: Ottieni il Tuo API Token**

1. Vai su **"Settings"** → **"API Tokens"**
2. Se non hai un token, creane uno
3. Copia il token

### **Passo 2: Verifica Regione con API**

Apri il terminale e esegui:

```bash
# Sostituisci YOUR_TOKEN con il tuo token reale
curl -X GET "https://api.axiom.co/v1/org" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oppure con PowerShell (Windows):**

```powershell
$token = "YOUR_TOKEN"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "https://api.axiom.co/v1/org" -Method Get -Headers $headers
```

La risposta conterrà informazioni sulla regione.

---

## ✅ Dopo Aver Cambiato/Creato Organization in EU

### **Passo 1: Verifica Regione**

1. Vai su **"Settings"** → **"Organization"**
2. Verifica che la regione sia **"EU"** o **"Europe"**
3. **Copia l'Organization ID**

### **Passo 2: Aggiorna Configurazione**

1. Apri il file `.env` del progetto
2. Aggiorna:
   ```env
   AXIOM_REGION=eu
   AXIOM_ORG_ID=nuovo-org-id
   AXIOM_API_TOKEN=nuovo-token-se-necessario
   ```

### **Passo 3: Verifica Configurazione**

```bash
node scripts/axiom-logger.js check
```

**Output atteso:**
```
🔍 Verifica configurazione Axiom...

Configurazione:
  Dataset: demosapp-logs
  Region: eu
  Enabled: true
  Token: ✅ Configurato
  Org ID: ✅ Configurato

🧪 Test connessione Axiom...
✅ Configurazione Axiom corretta
```

### **Passo 4: Test Invio**

```bash
node scripts/axiom-logger.js test
```

---

## 🆘 Se Nulla Funziona

Se nessuno dei metodi sopra funziona:

1. **Contatta il supporto Axiom** (Metodo 3) - è la soluzione più affidabile
2. **Crea un nuovo account Axiom** con regione EU durante la registrazione
3. **Usa l'organization esistente** ma configura `AXIOM_REGION=eu` nel codice (potrebbe funzionare se l'API accetta la regione come parametro)

---

## 📞 Informazioni di Contatto Supporto Axiom

- **Email**: support@axiom.co
- **Documentazione**: https://axiom.co/docs
- **Community**: https://github.com/axiomhq

---

## 💡 Nota Importante

**Anche se l'organization è in US, puoi comunque specificare `AXIOM_REGION=eu` nel codice.** L'SDK Axiom userà gli endpoint EU per l'invio dei log, anche se l'organization è in US. Tuttavia, per una conformità GDPR completa, è meglio avere l'organization stessa in EU.

---

**🎯 Raccomandazione: Contatta il supporto Axiom (Metodo 3) - è la soluzione più semplice e affidabile!**



