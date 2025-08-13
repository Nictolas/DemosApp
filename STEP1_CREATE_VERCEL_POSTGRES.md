# 🚀 STEP 1: Creazione Database Vercel Postgres

## 📋 **PREREQUISITI**
- Account Vercel attivo
- Progetto già deployato su Vercel
- Accesso al dashboard Vercel

---

## 🎯 **OBIETTIVO**
Creare un database PostgreSQL su Vercel e configurarlo per la tua applicazione DEMOS.

---

## 📝 **ISTRUZIONI PASSO-PASSO**

### **1.1 Accedi al Dashboard Vercel**

1. Vai su [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Accedi con il tuo account
3. Seleziona il progetto `DemosApp-1`

### **1.2 Crea il Database Postgres**

1. **Nella dashboard del progetto**, clicca su **"Storage"** nella barra laterale
2. Clicca su **"Create Database"**
3. Seleziona **"Postgres"** come tipo di database
4. Configura il database:
   - **Nome:** `demos-postgres`
   - **Regione:** `Frankfurt` (più vicina all'Italia)
   - **Piano:** `Hobby` (gratuito, 256MB)
5. Clicca su **"Create"**

### **1.3 Configura le Variabili d'Ambiente**

Dopo la creazione, Vercel aggiungerà automaticamente queste variabili al tuo progetto:

```
POSTGRES_URL=postgresql://username:password@host:port/database
POSTGRES_HOST=your-host
POSTGRES_DATABASE=your-database
POSTGRES_USERNAME=your-username
POSTGRES_PASSWORD=your-password
```

**Verifica che siano presenti:**
1. Vai su **"Settings"** → **"Environment Variables"**
2. Controlla che tutte le variabili POSTGRES_* siano presenti
3. Assicurati che siano configurate per **Production, Preview, Development**

### **1.4 Testa la Connessione**

Crea un file di test per verificare la connessione:

```bash
# Crea un file di test
touch test-db-connection.js
```

```javascript
// test-db-connection.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connessione database OK:', result.rows[0]);
  } catch (error) {
    console.error('❌ Errore connessione:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
```

Esegui il test:
```bash
node test-db-connection.js
```

---

## 🔧 **CONFIGURAZIONE AGGIUNTIVA**

### **1.5 Configura Google OAuth (per Auth.js)**

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona quello esistente
3. Abilita l'API Google+ 
4. Crea credenziali OAuth 2.0:
   - **Tipo:** Web application
   - **URI autorizzati:** `https://your-domain.vercel.app`
   - **URI di reindirizzamento:** `https://your-domain.vercel.app/api/auth/callback/google`
5. Copia `Client ID` e `Client Secret`

### **1.6 Aggiungi Variabili Auth.js**

Aggiungi queste variabili su Vercel:

```
NEXTAUTH_SECRET=your-generated-secret
NEXTAUTH_URL=https://your-domain.vercel.app
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Per generare NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## ✅ **VERIFICA COMPLETAMENTO**

### **Checklist Step 1:**

- [ ] Database Vercel Postgres creato
- [ ] Variabili POSTGRES_* configurate
- [ ] Test connessione database OK
- [ ] Google OAuth configurato
- [ ] Variabili Auth.js configurate
- [ ] NEXTAUTH_SECRET generato

---

## 🚨 **RISOLUZIONE PROBLEMI**

### **Problema: "Database creation failed"**
- **Soluzione:** Verifica che il nome del database sia unico
- **Soluzione:** Prova con un nome diverso

### **Problema: "Connection refused"**
- **Soluzione:** Verifica che le variabili POSTGRES_URL siano corrette
- **Soluzione:** Controlla che il database sia stato creato correttamente

### **Problema: "SSL connection failed"**
- **Soluzione:** Assicurati di usare `rejectUnauthorized: false` nelle opzioni SSL

### **Problema: "Google OAuth not working"**
- **Soluzione:** Verifica che gli URI di reindirizzamento siano corretti
- **Soluzione:** Controlla che le credenziali Google siano valide

---

## 📞 **SUPPORTO**

Se incontri problemi:

1. **Documentazione Vercel Postgres:** [https://vercel.com/docs/storage/vercel-postgres](https://vercel.com/docs/storage/vercel-postgres)
2. **Supporto Vercel:** [https://vercel.com/support](https://vercel.com/support)
3. **Community Discord:** [https://discord.gg/vercel](https://discord.gg/vercel)

---

## 🎯 **PROSSIMO STEP**

Una volta completato questo step, procedi con:
**STEP 2: Applicazione Schema Database**

---

## 📊 **COSTI STIMATI**

- **Piano Hobby:** Gratuito (256MB)
- **Piano Pro:** $20/mese (8GB)
- **Piano Enterprise:** Contatta Vercel

**Per iniziare, il piano Hobby è sufficiente!**
