# 🔄 Trasformare Account in Organization EU - Guida Passo-Passo

## 📋 Situazione Attuale

Vedi il messaggio:
```
You are not a member of any organizations.
Transform account
```

Questo significa che hai un **account personale** che deve essere trasformato in un'**organization**. Durante questa trasformazione, puoi selezionare la regione EU!

---

## ✅ Soluzione: Trasforma Account in Organization EU

### **Passo 1: Clicca su "Transform account"**

1. Nella pagina **"Organizations"**, vedi il pulsante **"Transform account"**
2. **Clicca su "Transform account"**

### **Passo 2: Compila il Form di Creazione Organization**

Dopo aver cliccato, si aprirà un form. Compila:

1. **Organization Name**:
   - Inserisci: `DemosApp` o `DemosApp EU` (o un nome a tua scelta)
   - Questo sarà il nome della tua organization

2. **Region** (⚠️ IMPORTANTE):
   - Cerca il campo **"Region"** o **"Data Region"**
   - **Seleziona "EU"** o **"Europe"**
   - ⚠️ **QUESTO È IL MOMENTO PER SELEZIONARE EU!**

3. **Altri campi** (se presenti):
   - Compila eventuali altri campi richiesti
   - Leggi attentamente le opzioni

### **Passo 3: Conferma la Creazione**

1. Rivedi le informazioni inserite
2. Assicurati che la regione sia **"EU"** o **"Europe"**
3. Clicca su **"Create Organization"** o **"Transform"** o **"Save"**

### **Passo 4: Verifica la Regione**

Dopo la creazione:

1. Vai su **"Settings"** → **"Organization"**
2. Verifica che la regione sia **"EU"** o **"Europe"**
3. **Copia l'Organization ID** (ti servirà dopo)

---

## 🆘 Se NON Vedi l'Opzione per Selezionare la Regione

Se durante la trasformazione NON vedi l'opzione per selezionare la regione:

### **Opzione A: Controlla Tutte le Pagine del Form**

1. Il form potrebbe avere più pagine
2. Clicca su **"Next"** o **"Continue"** per vedere altre opzioni
3. La regione potrebbe essere nella seconda o terza pagina

### **Opzione B: Cerca "Advanced Settings"**

1. Cerca un link **"Advanced Settings"** o **"More Options"**
2. La regione potrebbe essere nelle impostazioni avanzate

### **Opzione C: Contatta il Supporto**

Se non trovi l'opzione per selezionare la regione:

1. **NON completare** la trasformazione ancora
2. Contatta il supporto Axiom:
   - Email: support@axiom.co
   - Messaggio:

```
Hi Axiom Support,

I'm trying to transform my personal account into an organization, and I need to select the EU region for GDPR compliance. However, I don't see an option to select the region during the transformation process.

Could you please help me:
1. Transform my account into an organization with EU region, or
2. Guide me on how to select EU region during transformation?

Account email: [TUA EMAIL]

Thank you!
```

---

## ✅ Dopo Aver Trasformato l'Account

### **Passo 1: Verifica Organization**

1. Vai su **"Settings"** → **"Organization"**
2. Dovresti vedere:
   - Nome organization
   - Organization ID
   - **Region: EU** ✅

### **Passo 2: Crea Dataset**

1. Vai su **"Datasets"** nel menu laterale
2. Clicca su **"Create Dataset"**
3. Nome: `demosapp-logs`
4. Clicca **"Create"**

### **Passo 3: Crea API Token**

1. Vai su **"Settings"** → **"API Tokens"**
2. Clicca su **"Create Token"**
3. Nome: `demosapp-production`
4. Permessi: ✅ **"Ingest"** e ✅ **"Query"**
5. Clicca **"Create"**
6. **COPIA IL TOKEN** (lo vedrai solo una volta!)

### **Passo 4: Configura il Progetto**

1. Apri il file `.env` del progetto
2. Aggiungi/aggiorna:

```env
# Axiom Configuration
AXIOM_ENABLED=true
AXIOM_API_TOKEN=il-token-che-hai-copiato
AXIOM_ORG_ID=l-org-id-dalla-pagina-organization
AXIOM_DATASET=demosapp-logs
AXIOM_REGION=eu

# GDPR
AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=your-secure-random-salt
```

3. Installa SDK (se non l'hai già fatto):
   ```bash
   npm install @axiomhq/axiom-node
   ```

4. Verifica configurazione:
   ```bash
   node scripts/axiom-logger.js check
   ```

---

## 📸 Cosa Dovresti Vedere

### **Durante la Trasformazione:**

```
┌─────────────────────────────────────┐
│  Transform Account to Organization  │
├─────────────────────────────────────┤
│                                     │
│  Organization Name: [___________]   │
│                                     │
│  Region:                            │
│  ○ US (United States)               │
│  ● EU (Europe)  ← SELEZIONA QUESTO │
│                                     │
│  [Cancel]  [Create Organization]    │
└─────────────────────────────────────┘
```

### **Dopo la Trasformazione (Settings → Organization):**

```
Organization Settings
─────────────────────
Name: DemosApp
Organization ID: abc123def456
Region: EU ✅
```

---

## 🆘 Problemi Comuni

### **Problema: Non vedo l'opzione "Region"**

**Soluzione**:
1. Controlla se ci sono più pagine nel form (clicca "Next")
2. Cerca "Advanced Settings" o "More Options"
3. Se non trovi nulla, contatta il supporto PRIMA di completare la trasformazione

### **Problema: Ho già trasformato l'account ma la regione è US**

**Soluzione**:
1. Contatta il supporto Axiom immediatamente
2. Spiega che hai appena trasformato l'account ma la regione è sbagliata
3. Chiedi di cambiarla in EU

### **Problema: Il pulsante "Transform account" non funziona**

**Soluzione**:
1. Prova a ricaricare la pagina (F5)
2. Prova con un altro browser
3. Contatta il supporto

---

## 📞 Supporto Axiom

Se hai problemi durante la trasformazione:

- **Email**: support@axiom.co
- **Chat**: Cerca "Support" o "Help" nella dashboard
- **Documentazione**: https://axiom.co/docs

---

## ✅ Checklist

- [ ] Cliccato su "Transform account"
- [ ] Compilato nome organization
- [ ] **Selezionato regione EU** ⚠️ IMPORTANTE
- [ ] Confermata creazione organization
- [ ] Verificata regione EU in Settings → Organization
- [ ] Copiato Organization ID
- [ ] Creato dataset `demosapp-logs`
- [ ] Creato API Token
- [ ] Configurato `.env` con tutte le variabili
- [ ] Testato configurazione: `node scripts/axiom-logger.js check`

---

**🎯 IMPORTANTE: Quando clicchi "Transform account", cerca attentamente l'opzione per selezionare la regione EU. Se non la vedi, NON completare la trasformazione e contatta il supporto!**

