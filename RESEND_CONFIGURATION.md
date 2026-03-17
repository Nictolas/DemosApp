# Configurazione Resend per DEMOS App

## 🚨 **Problema Attuale**

Resend è configurato in modalità **TEST** e può inviare email solo a:
- `nicolasmicheletti90@gmail.com` (email del proprietario dell'account)

## 🛠️ **Soluzioni Disponibili**

### **Soluzione 1: Verifica Dominio (Raccomandata per Produzione)**

#### Passo 1: Accedi a Resend
1. Vai su [resend.com](https://resend.com)
2. Accedi al tuo account
3. Vai su "Domains" nel menu laterale

#### Passo 2: Aggiungi il Tuo Dominio
1. Clicca "Add Domain"
2. Inserisci: `demos.community`
3. Clicca "Add Domain"

#### Passo 3: Configura i Record DNS
Resend ti fornirà questi record da aggiungere al tuo DNS:

```dns
# Record TXT per verifica
TXT  @  resend-verification=abc123...

# Record MX per email
MX   @  10  mxa.resend.com
MX   @  20  mxb.resend.com

# Record SPF per autenticazione
TXT  @  v=spf1 include:spf.resend.com ~all

# Record CNAME per tracking
CNAME  tracking.demos.community  cname.resend.com
```

#### Passo 4: Cambia l'Indirizzo From
Una volta verificato il dominio, modifica il codice:

```javascript
// In api/index.js, cambia:
from: process.env.EMAIL_FROM || 'Demos Community <noreply@demos.community>'
```

### **Soluzione 2: Configurazione Temporanea per Test**

#### Codice Attuale (Già Implementato)
```javascript
// Per test, invia sempre al tuo email se non è il tuo
const testEmail = email === 'nicolasmicheletti90@gmail.com' ? email : 'nicolasmicheletti90@gmail.com';
```

#### Come Funziona
- **Se l'utente è tu**: Ricevi l'email normalmente
- **Se l'utente è un altro**: L'email viene inviata al tuo indirizzo per test
- **Messaggio utente**: Viene informato che l'email è stata inviata per test

## 🔧 **Configurazione Ambiente**

### **Variabili d'Ambiente (.env)**
```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Email From (per produzione)
EMAIL_FROM=Demos Community <noreply@demos.community>

# Frontend URL
FRONTEND_URL=https://www.demos.community
```

### **Configurazione per Sviluppo**
```bash
# Per sviluppo locale
EMAIL_FROM=Demos Community <onboarding@resend.dev>
FRONTEND_URL=http://localhost:3000
```

## 📧 **Test delle Email**

### **Test Locale**
1. Avvia l'applicazione: `npm run dev`
2. Vai su `/auth` e clicca "Password dimenticata"
3. Inserisci qualsiasi email
4. L'email verrà inviata a `nicolasmicheletti90@gmail.com`

### **Test Produzione**
1. Verifica il dominio su Resend
2. Configura i record DNS
3. Cambia l'indirizzo `from` nel codice
4. Testa con email reali

## 🚀 **Deploy delle Modifiche**

### **Render.com**
1. Commit e push delle modifiche
2. Render si riavvia automaticamente
3. Le nuove configurazioni sono attive

### **Verifica Deploy**
1. Controlla i log su Render
2. Testa la funzionalità reset password
3. Verifica che le email arrivino correttamente

## 📋 **Stato Attuale**

- ✅ **Configurazione temporanea**: Implementata per test
- ⏳ **Dominio verificato**: Da completare
- ⏳ **Configurazione produzione**: Da completare

## 🎯 **Prossimi Passi**

1. **Immediato**: Le email di test funzionano già
2. **Breve termine**: Verifica il dominio su Resend
3. **Medio termine**: Configura i record DNS
4. **Lungo termine**: Passa alla configurazione produzione

## 🔍 **Troubleshooting**

### **Errore: "You can only send testing emails"**
- **Causa**: Dominio non verificato
- **Soluzione**: Verifica il dominio su Resend

### **Errore: "Domain not verified"**
- **Causa**: Record DNS non configurati
- **Soluzione**: Aggiungi i record DNS forniti da Resend

### **Email non arrivano**
- **Causa**: Record DNS non propagati
- **Soluzione**: Aspetta 24-48 ore per la propagazione DNS
