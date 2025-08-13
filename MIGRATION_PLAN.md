# 🚀 Piano di Migrazione a Vercel Postgres

## 📋 **STATO ATTUALE**
- **Frontend:** React + Vite su Vercel ✅
- **Database:** PostgreSQL su Keliweb + Firestore Firebase
- **Auth:** Firebase Auth
- **Backend:** API Express con PostgreSQL

## 🎯 **OBIETTIVO FINALE**
- **Database:** Vercel Postgres (unificato)
- **Auth:** Auth.js (NextAuth)
- **Backend:** API Routes di Next.js
- **Tutto integrato su Vercel**

---

## 📝 **STEP 1: Creazione Vercel Postgres**

### 1.1 Accedi a Vercel Dashboard
- Vai su https://vercel.com/dashboard
- Seleziona il tuo progetto `DemosApp-1`

### 1.2 Crea Database Postgres
- Clicca su "Storage" → "Create Database"
- Seleziona "Postgres"
- Nome: `demos-postgres`
- Regione: `Frankfurt` (più vicina all'Italia)
- Piano: `Hobby` (gratuito, 256MB)

### 1.3 Configura Variabili d'Ambiente
Vercel creerà automaticamente queste variabili:
```
POSTGRES_URL=postgresql://...
POSTGRES_HOST=...
POSTGRES_DATABASE=...
POSTGRES_USERNAME=...
POSTGRES_PASSWORD=...
```

---

## 📝 **STEP 2: Migrazione Schema Database**

### 2.1 Schema Aggiornato per Vercel Postgres
Il file `server/database/schema.sql` è già perfetto per Vercel Postgres.

### 2.2 Comandi per Applicare Schema
```bash
# Connetti al database Vercel Postgres
psql $POSTGRES_URL

# Applica lo schema
\i server/database/schema.sql
```

---

## 📝 **STEP 3: Script di Migrazione Dati**

### 3.1 Migrazione da Keliweb PostgreSQL
- Esporta dati da Keliweb
- Importa in Vercel Postgres

### 3.2 Migrazione da Firestore
- Script per esportare collezioni Firestore
- Conversione in formato PostgreSQL

---

## 📝 **STEP 4: Implementazione Auth.js**

### 4.1 Installazione Dipendenze
```bash
npm install next-auth @auth/postgresql-adapter
```

### 4.2 Configurazione Auth.js
- Provider: Credentials + Google
- Adapter: PostgreSQL
- Database: Vercel Postgres

---

## 📝 **STEP 5: Migrazione API**

### 5.1 Conversione API Routes
- Da Express a Next.js API Routes
- Mantenimento stessa logica di business
- Aggiornamento connessioni database

### 5.2 Aggiornamento Frontend
- Sostituzione chiamate Firebase
- Integrazione con Auth.js
- Aggiornamento hooks

---

## 📝 **STEP 6: Testing e Deploy**

### 6.1 Testing Locale
- Test autenticazione
- Test operazioni database
- Test funzionalità app

### 6.2 Deploy su Vercel
- Push su GitHub
- Deploy automatico
- Verifica funzionamento

---

## 🔧 **FILE DA MODIFICARE**

### Frontend
- `client/src/lib/firebase.ts` → `client/src/lib/auth.ts`
- `client/src/hooks/use-auth.tsx` → Auth.js hooks
- Tutti i componenti che usano Firebase

### Backend
- `server/` → `pages/api/`
- `api/` → `pages/api/`
- Configurazione database

### Database
- Schema già pronto
- Script migrazione dati
- Configurazione Auth.js adapter

---

## ⚠️ **RISCHI E MITIGAZIONI**

### Rischi
- **Downtime durante migrazione**
- **Perdita dati**
- **Incompatibilità API**

### Mitigazioni
- **Backup completo prima della migrazione**
- **Testing su ambiente staging**
- **Rollback plan**
- **Migrazione graduale**

---

## 📊 **TIMELINE STIMATA**

- **Step 1-2:** 1 giorno (setup database)
- **Step 3:** 2-3 giorni (migrazione dati)
- **Step 4:** 1-2 giorni (Auth.js)
- **Step 5:** 3-4 giorni (API migration)
- **Step 6:** 1 giorno (testing e deploy)

**TOTALE: 8-11 giorni**

---

## 🎯 **PROSSIMI PASSI**

1. **Oggi:** Creare Vercel Postgres
2. **Domani:** Applicare schema e iniziare migrazione dati
3. **Settimana prossima:** Implementare Auth.js
4. **Fine settimana:** Migrare API e testare

---

## 📞 **SUPPORTO**

Per qualsiasi problema durante la migrazione:
- Documentazione Vercel Postgres
- Community Auth.js
- Stack Overflow
- Supporto Vercel (se necessario)
