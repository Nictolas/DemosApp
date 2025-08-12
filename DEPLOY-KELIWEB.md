# 🚀 DEPLOY API SU KELIWEB

## 📋 **COSA FARE:**

### **1. UPLOAD SU KELIWEB**
- Carica il file `api-keliweb.php` nella root del tuo hosting Keliweb
- Assicurati che sia accessibile via web

### **2. CONFIGURA DATABASE**
Modifica `api-keliweb.php` e sostituisci:
```php
$host = 'localhost'; // Database locale su Keliweb
$dbname = 'NOME_DATABASE_REALE'; // Il tuo database
$username = 'NOME_UTENTE_REALE'; // Il tuo utente
$password = 'PASSWORD_REALE'; // La tua password
```

### **3. TEST API KELIWEB**
Testa direttamente su Keliweb:
```
https://tuodominio.com/api-keliweb.php/health
```
Dovrebbe restituire: `{"status":"OK","message":"API Keliweb funzionante"}`

### **4. CONFIGURA VERCEL**
Modifica `api/index.js` e sostituisci:
```javascript
const KELIWEB_API_URL = 'https://TUODOMINIO.com/api-keliweb.php';
```

### **5. DEPLOY VERCEL**
Fai commit e push per attivare l'API proxy!

## ✅ **VANTAGGI:**
- ✅ **Database funziona** - Connessione locale su Keliweb
- ✅ **Vercel funziona** - Chiama solo API esterne
- ✅ **Nessuna migrazione** - Database rimane su Keliweb
- ✅ **API completa** - Tutti gli endpoint funzionano

## 🔧 **TROUBLESHOOTING:**
- Se API Keliweb non risponde: controlla configurazione database
- Se Vercel 500: controlla URL API Keliweb
- Se CORS error: l'API Keliweb ha già headers CORS

## 🎯 **RISULTATO FINALE:**
L'app DEMOS funzionerà completamente con:
- Frontend su Vercel ✅
- API Proxy su Vercel ✅  
- Database su Keliweb ✅
