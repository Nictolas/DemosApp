# 💾 Export Dati su Hard Disk Esterno

> **ATTENZIONE — DOCUMENTO STORICO NON OPERATIVO (03/11/2026).** Questa guida descrive una soluzione Neon/log/export legacy non autorizzata. **NON eseguire** gli esempi, non installare cron/Task Scheduler, non avviare esportazioni cloud e **non eliminare** file, versioni o righe SQL. La [PR #580](https://github.com/Nictolas/DemosApp/pull/580) contiene blocchi fail-closed **solo Draft, non distribuiti**; lo script `cloud-backup-export.js` è stato ritirato sulla stessa PR. L'archiviazione attuale Axiom→B2 è distinta. Il recupero GDPR da B2 (GH-296), l'integrità/versioning/Object Lock, la retention e il restore indipendente sono ancora **NO-GO**, subordinati a evidenze reali, revisione DPO e autorizzazione specifica. Stime di costi e dichiarazioni di conformità sottostanti sono storiche e non verificate.


Sistema completo per esportare i dati storici dal database Neon su hard disk esterno, alleggerendo il database e rispettando le policy GDPR.

## 🎯 Obiettivo

- **Alleggerire il database Neon** mantenendo solo gli ultimi 30 giorni
- **Rispettare il GDPR** con anonimizzazione e retention policy
- **Risparmiare sui costi** del database cloud
- **Mantenere accessibilità** ai dati storici

## 📋 Funzionalità

### ✅ **Export Automatico**
- Export programmato con cron job
- Selezione tabelle specifiche
- Compressione automatica (GZIP)
- Organizzazione per data

### ✅ **Interfaccia Web**
- Dashboard admin completa
- Monitoraggio in tempo reale
- Cronologia export
- Download file esportati

### ✅ **GDPR Compliant**
- Anonimizzazione dati personali
- Policy di retention configurabili
- Log di tutte le operazioni
- Diritto alla cancellazione

## 🚀 Installazione

### 1. **Configurazione Hard Disk**

```bash
# Monta hard disk esterno
sudo mkdir -p /mnt/external-drive
sudo mount /dev/sdb1 /mnt/external-drive

# Crea directory archivio
sudo mkdir -p /mnt/external-drive/archivio
sudo chown $USER:$USER /mnt/external-drive/archivio
```

### 2. **Configurazione Ambiente**

```bash
# Copia file configurazione
cp export-config.example.env .env

# Modifica configurazione
nano .env
```

### 3. **Installazione Dipendenze**

```bash
# Installa dipendenze Node.js
npm install archiver

# Installa cron (Linux/Mac)
sudo apt-get install cron  # Ubuntu/Debian
brew install cron          # macOS
```

## 🔧 Utilizzo

### **Interfaccia Web**

1. **Accedi alla dashboard admin**
   ```
   https://tuodominio.com/admin/data-export
   ```

2. **Seleziona tabelle da esportare**
   - ✅ Centralized Logs
   - ✅ Security Events  
   - ✅ Performance Metrics
   - ✅ Health Checks
   - ✅ Access Audit
   - ✅ Audit Logs

3. **Configura opzioni**
   - 🗑️ Elimina dati dopo export
   - 🧪 Modalità test (dry-run)
   - 📊 Monitoraggio progresso

4. **Avvia export**
   - Clicca "Avvia Export"
   - Monitora progresso in tempo reale
   - Download file completati

### **Script da Terminale**

```bash
# Export completo
node scripts/hard-disk-export.js export

# Export con eliminazione dati
# DISABILITATO: non eseguire export con cancellazione

# Modalità test (solo conteggi)
node scripts/hard-disk-export.js dry-run

# Lista file esportati
node scripts/hard-disk-export.js list
```

### **Automazione con Cron**

```bash
# Apri crontab
crontab -e

# Aggiungi export giornaliero alle 2:00 AM
# DISABILITATO: non configurare il cron legacy

# Aggiungi export settimanale (domenica 3:00 AM)
# DISABILITATO: non configurare il cron legacy
```

## 📊 Struttura File

```
/mnt/external-drive/archivio/
├── 2024/
│   ├── 01-gennaio/
│   │   ├── centralized_logs_2024-01-15_part1.csv.gz
│   │   ├── security_events_2024-01-15_part1.csv.gz
│   │   ├── performance_metrics_2024-01-15_part1.csv.gz
│   │   └── index.json
│   └── 02-febbraio/
├── 2023/
└── index_generale.json
```

## 🔒 Sicurezza e GDPR

### **Anonimizzazione Automatica**

| Campo | Trattamento |
|-------|-------------|
| **IP Address** | Solo rete (192.168.1.0) |
| **User Agent** | Solo browser/OS |
| **User ID** | Hash SHA-256 |
| **Email** | Hash SHA-256 |
| **Session ID** | Hash SHA-256 |

### **Policy di Retention**

| Tabella | Database | Archivio | Totale |
|---------|----------|----------|---------|
| Security Events | 30 giorni | 1 anno | 15 mesi |
| Performance Metrics | 7 giorni | 1 mese | 5 settimane |
| Centralized Logs | 14 giorni | 2 mesi | 10 settimane |
| Access Audit | 30 giorni | 6 mesi | 7 mesi |
| Audit Logs | 30 giorni | 6 mesi | 7 mesi |

### **Diritti GDPR**

- ✅ **Diritto all'accesso**: Dati accessibili entro 30 giorni
- ✅ **Diritto alla portabilità**: Export in formato CSV/JSON
- ✅ **Diritto alla rettifica**: Modifica dati nel database attivo
- ✅ **Diritto alla cancellazione**: Eliminazione completa
- ✅ **Diritto all'oblio**: Anonimizzazione automatica

## 📈 Monitoraggio

### **Dashboard Statistiche**

- 📊 Dimensioni database attuale
- 📁 File esportati totali
- 💾 Spazio utilizzato su hard disk
- ⏱️ Ultimo export eseguito
- 🚨 Alert per soglie critiche

### **API Endpoints**

```bash
# Statistiche generali
GET /api/admin/data-export/stats

# Informazioni tabelle
GET /api/admin/data-export/tables

# Stato export in corso
GET /api/admin/data-export/status

# Cronologia export
GET /api/admin/data-export/history

# Download export specifico
GET /api/admin/data-export/download/:exportId
```

## 🛠️ Risoluzione Problemi

### **Hard Disk Non Montato**

```bash
# Verifica montaggio
ls -la /mnt/external-drive/

# Monta manualmente
sudo mount /dev/sdb1 /mnt/external-drive

# Montaggio automatico (fstab)
echo "/dev/sdb1 /mnt/external-drive ext4 defaults 0 2" | sudo tee -a /etc/fstab
```

### **Permessi Directory**

```bash
# Corregge permessi
sudo chown -R $USER:$USER /mnt/external-drive/archivio
chmod -R 755 /mnt/external-drive/archivio
```

### **Spazio Insufficiente**

```bash
# Verifica spazio disponibile
df -h /mnt/external-drive/

# Pulisci export vecchi
# DISABILITATO: non cancellare archivi in base alla sola età
```

### **Export Interrotto**

```bash
# Verifica processi in corso
ps aux | grep hard-disk-export

# Termina processo
kill -9 <PID>

# Riprendi export
node scripts/hard-disk-export.js export
```

## 💰 Risparmio Economico

### **Prima (Solo Neon)**
- Database: 10GB = ~$100/mese
- Performance: Lenta con molti dati
- Backup: Solo cloud

### **Dopo (Hard Disk + Neon)**
- Database: 2GB = ~$20/mese
- Hard Disk: 8GB = €0 (una tantum)
- **Risparmio: ~80%**

## 🔄 Backup e Recovery

### **Backup Automatico**

```bash
# Backup su cloud (opzionale)
rsync -av /mnt/external-drive/archivio/ user@backup-server:/backup/archivio/

# Backup locale
tar -czf backup_$(date +%Y%m%d).tar.gz /mnt/external-drive/archivio/
```

### **Recovery Dati**

```bash
# Ripristina da backup
tar -xzf backup_20240115.tar.gz -C /

# Importa dati specifici
gunzip -c centralized_logs_2024-01-15_part1.csv.gz | psql -d database -c "COPY centralized_logs FROM STDIN WITH CSV HEADER;"
```

## 📞 Supporto

Per problemi o domande:

1. **Controlla i log**: `tail -f logs/export.log`
2. **Verifica configurazione**: `cat .env`
3. **Testa connessione**: `node scripts/hard-disk-export.js dry-run`
4. **Contatta supporto**: admin@demosapp.it

---

**🎉 Il sistema è pronto per alleggerire il tuo database Neon mantenendo tutti i dati storici accessibili e rispettando il GDPR!**
