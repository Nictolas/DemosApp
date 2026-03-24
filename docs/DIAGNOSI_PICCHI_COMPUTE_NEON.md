# Diagnosi: picchi compute Neon e “blocchi” ~300 MB

## 1. Cosa significa il grafico Neon (RAM ~0.25 GB)

Nel dashboard Neon, **RAM usage** non sale “a caso” in blocchi arbitrari: quando il compute è **attivo**, l’autoscaling ha un **minimo** (nel vostro caso tipico **0.25 CU**).  
A quel livello, la RAM allocata al processo Postgres è circa **~250–300 MB** (ordine di grandezza coerente con lo step che vedi).

Quindi:

- I “blocchi” verticali nel grafico indicano soprattutto **finestre in cui il compute è acceso** (o sale al minimo allocabile), non un bug di “300 MB di dati” che arrivano a ondate.
- Il **consumo in CU-h** cresce mentre il compute resta attivo ed esegue lavoro (query).

Riferimento UI: branch **main**, compute **0.25 → 2 CU** (autoscale).

## 2. Evidenza dal codice (query frequenti)

### 2.1 `PerformanceOptimizer` — ogni 10 secondi (prima della correzione)

File: `api/services/performanceOptimizer.js`

- `updateMetrics()` gira su intervallo breve e chiama `getActiveUsersCount()` che esegue:

```sql
SELECT COUNT(*) AS count
FROM users
WHERE created_at > NOW() - INTERVAL '15 minutes';
```

Questa query è **molto frequente** se l’intervallo è 10s → **~8.640 esecuzioni/giorno** solo da questo job, oltre al traffico reale.  
È coerente con pattern visti in `pg_stat_statements` (alte `calls`).

### 2.2 `PerformanceMonitor` — ogni 30 secondi (avvio in `api/app.js`)

File: `api/services/performanceMonitor.js`

Ogni tick `collectMetrics()` chiama `getDatabaseMetrics()` che include:

- `pg_stat_activity` (connessioni)
- `pg_database_size(current_database())` — costosa se chiamata spesso
- `pg_stat_statements` (top slow queries)

Intervallo: `performanceMonitor.start(30000)` → **~2.880 volte/giorno** per quel blocco di query.

### 2.3 `HealthCheckService` — quando qualcuno chiama health monitoring

File: `api/services/healthCheckService.js`

`checkDatabase()` esegue `COUNT(*)` su `users` con filtro **1 giorno**.  
Ogni refresh della dashboard health/admin può ripeterla.

## 3. Perché i picchi sembrano “random”

- Traffico utenti e admin **non è periodico** come un cron.
- **Wake/sleep** del compute Neon: se il DB va in stato idle/sospensione e poi si risveglia, il grafico mostra salti netti.
- Più processi in parallelo (monitor 30s + optimizer 10s + richieste HTTP) → sovrapposizione non allineata al minuto.

## 4. Come correlare un picco reale (checklist operativa)

1. Nel Neon dashboard, annota **orario UTC** di un picco RAM/CU.
2. Su Neon **SQL Editor**, esegui (una tantum):

```sql
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
```

3. Cerca le query che corrispondono a:
   - `COUNT(*) ... users ... INTERVAL '15 minutes'`
   - `pg_database_size(current_database())`
   - `pg_stat_activity`
4. Incrocia con log Render/backend nello stesso intervallo (deploy, admin che apre monitoring, job abilitati).

## 5. Contromisure già applicate o consigliate

| Azione | Effetto |
|--------|---------|
| Aumentare intervallo `updateMetrics` dell’optimizer (es. 60s+) via env | Riduce drasticamente le `calls` sulla tabella `users` |
| Tenere disabilitati job non essenziali (`ENABLE_*` ≠ `true`) | Evita burst periodici |
| Fermare monitoraggio dall’UI quando non serve | Riduce tick 30s su metriche DB |
| Cache breve su endpoint admin pesanti | Meno ripetizioni sotto refresh multipli |

## 6. Query SQL utili (Neon)

Reset statistiche (solo dopo analisi, in finestra di manutenzione):

```sql
SELECT pg_stat_statements_reset();
```

Verifica estensione:

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
```

---

*Documento generato nell’ambito della diagnosi picchi compute; aggiornare se cambiano intervalli o job.*
