# Record DKIM Completo per Resend

## 🔍 **Come Ottenere il Valore Completo**

### **Passo 1: Torna su Resend**
1. Apri la tab **"Resend"** nel browser
2. Vai su **"Domains"** → **"demos.community"**
3. Nella sezione **"DKIM and SPF"**, troverai il record completo

### **Passo 2: Copia il Record DKIM Completo**

Il record dovrebbe essere simile a questo (ma con valori diversi):

```
Type: TXT
Name: resend._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7VJTUtXwwSx67eKbQwJHWQ8GQKLuM2lfBLaVx3Y1Q+j1gokw0CHS3QkPDki7lY3ZvQQGiNpG+Up/4vhHZ9vLd6bfgfUG4GW0+qkrxrXgMjwccSxJncjDbby5AI89M7C4B2DBMlMD+W2GrKjHpG3x/ktbw8T3kny+lxplqQ1M2kOSga6jJWzPmJIEyXjpjLnhgN+okjZos4i0JTHrVWBY4y5VnBmJ7n08EqCuHZjfxeIxSNzfy/5q9Wx50fkaLtqK2DKwxrDg6Ag0E/rPidvLeU0Xrx4+4Xqr9oQ7XfgOLhEQwDlSCJsfQNn/EnzD6mO18CLxSJzVOjBmW5Cmfu3c2kPVXEUYzRDRz+1Qnlcvj7cmcz6eZ77ur2EpvKq+v0eHJSvAgMBAAE=
TTL: Auto
```

### **⚠️ IMPORTANTE**

- **Non usare il valore di esempio sopra** - è solo per riferimento
- **Copia il valore esatto** dalla tua dashboard Resend
- **Il valore è molto lungo** (circa 200-300 caratteri)
- **Inizia sempre con "p="**

### **Passo 3: Aggiungi il Record su Vercel**

Una volta copiato il valore completo:

1. **Vai su Vercel Dashboard**
2. **Settings** → **Domains** → **demos.community**
3. **"Add Record"**
4. **Compila:**
   - **Type**: TXT
   - **Name**: resend._domainkey
   - **Value**: (incolla il valore completo copiato da Resend)
   - **TTL**: Auto

### **🔍 Se Non Vedi il Record DKIM su Resend**

Potrebbe essere che:
1. **Il dominio non è ancora stato aggiunto** correttamente
2. **I record DNS precedenti** non sono stati verificati
3. **Resend sta ancora generando** i record

### **📋 Ordine Corretto per Aggiungere i Record**

1. **Prima**: Record MX
2. **Poi**: Record TXT per SPF
3. **Infine**: Record TXT per DKIM

### **🎯 Prossimo Passo**

**Torna su Resend e copia il valore completo del record DKIM**, poi te lo incolli qui così posso aiutarti a configurarlo correttamente!
